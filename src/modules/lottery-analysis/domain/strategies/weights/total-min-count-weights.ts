import { WeightsFunction } from './weights-function';

export const totalMinCountWeights: WeightsFunction = (
  data: number[][],
  weights: number[],
): Promise<number[]> => {
  if (data.length === 0) return Promise.resolve([]);

  const NUMBER_OF_POSITION = 6;
  const MAX_LOTTO_NUMBER = 45;

  const mainPlacer: { num: number; score: number }[] = [];

  for (let i = 1; i <= MAX_LOTTO_NUMBER; i++) {
    mainPlacer.push({ num: i, score: 0 });
  }

  const positionOrder = weights
    .map((weight, index) => ({ pos: index, weight }))
    .sort((a, b) => b.weight - a.weight);

  const mainNumbers: number[] = new Array(NUMBER_OF_POSITION).fill(0);
  const usedNumbers = new Set<number>();

  for (let rank = 0; rank < positionOrder.length; rank++) {
    const i = positionOrder[rank].pos;

    for (let episode = 0; episode < data.length; episode++) {
      const num = data[episode][i];
      if (num < 1 || num > MAX_LOTTO_NUMBER) continue;

      mainPlacer[num - 1].score += rank * 0.01 + 1;
    }
  }

  const sortedMain = mainPlacer
    .filter((placer) => placer.score > 0)
    .sort((a, b) => a.score - b.score);

  let mainIdx = 0;

  for (let i = 0; i < NUMBER_OF_POSITION; i++) {
    while (
      mainIdx < sortedMain.length &&
      usedNumbers.has(sortedMain[mainIdx].num)
    ) {
      mainIdx++;
    }
    const choice = sortedMain[mainIdx++];
    if (choice) {
      mainNumbers[i] = choice.num;
      usedNumbers.add(choice.num);
    }
  }

  mainNumbers.sort((a, b) => a - b);

  return Promise.resolve(mainNumbers);
};
