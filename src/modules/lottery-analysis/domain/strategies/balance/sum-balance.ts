import { BalanceFunction } from './balance-function';

export const sumBalance: BalanceFunction = (
  data: number[][],
): Promise<number[]> => {
  if (data.length === 0) return Promise.resolve([]);

  const sumList = data.map((draw) =>
    draw.slice(0, 6).reduce((a, b) => a + b, 0),
  );

  const average = sumList.reduce((a, b) => a + b, 0) / sumList.length;

  const MARGIN = 25;
  const minTargetSum = average - MARGIN;
  const maxTargetSum = average + MARGIN;

  let result: number[] = [];
  let isTargetFound = false;

  let attempts = 0;
  const MAX_ATTEMPTS = 1000;

  while (!isTargetFound && attempts < MAX_ATTEMPTS) {
    attempts++;
    const currentSet = new Set<number>();

    while (currentSet.size < 6) {
      const random = Math.floor(Math.random() * 45) + 1;
      currentSet.add(random);
    }

    const candidateNumbers = Array.from(currentSet);
    const currentSum = candidateNumbers.reduce((a, b) => a + b, 0);

    if (currentSum >= minTargetSum && currentSum <= maxTargetSum) {
      result = candidateNumbers;
      isTargetFound = true;
    }
  }

  if (result.length === 0) {
    result = [Math.floor(Math.random() * 45) + 1];
  }

  return Promise.resolve(result.sort((a, b) => a - b));
};
