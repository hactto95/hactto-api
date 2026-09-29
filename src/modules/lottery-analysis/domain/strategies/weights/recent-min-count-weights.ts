import { WeightsFunction } from './weights-function';

export const recentMinCountWeights: WeightsFunction = (
  data: number[][],
  weights: number[],
): Promise<number[]> => {
  if (data.length === 0) return Promise.resolve([]);

  const NUMBER_OF_POSITIONS = 6;
  const MAX_LOTTO_NUMBER = 45;
  const RECENT_EPISODE_COUNT = 50;

  const recentData = data.slice(-Math.min(data.length, RECENT_EPISODE_COUNT));

  const hitCounts = Array.from({ length: NUMBER_OF_POSITIONS }, () =>
    new Array(MAX_LOTTO_NUMBER + 1).fill(0),
  );

  const lastHitEpisode = Array.from({ length: NUMBER_OF_POSITIONS }, () =>
    new Array(MAX_LOTTO_NUMBER + 1).fill(-1),
  );

  for (let i = 0; i < recentData.length; i++) {
    const winningNumbers = recentData[i];

    for (let j = 0; j < NUMBER_OF_POSITIONS; j++) {
      const num = winningNumbers[j];

      hitCounts[j][num]++;
      lastHitEpisode[j][num] = i;
    }
  }

  const positionOrder = weights
    .map((weight, index) => ({ pos: index, weight }))
    .sort((a, b) => b.weight - a.weight);

  const result: number[] = new Array(NUMBER_OF_POSITIONS).fill(0);
  const usedNumbers = new Set<number>();

  const getPlaceCount = (rank: number) => Math.max(1, 5 - rank);

  for (let rank = 0; rank < positionOrder.length; rank++) {
    const i = positionOrder[rank].pos;

    const placer: { num: number; count: number; episode: number }[] = [];

    for (let num = 1; num <= MAX_LOTTO_NUMBER; num++) {
      if (usedNumbers.has(num) || hitCounts[i][num] === 0) continue;

      placer.push({
        num,
        count: hitCounts[i][num],
        episode: lastHitEpisode[i][num],
      });
    }

    if (placer.length === 0) {
      for (let num = 1; num <= MAX_LOTTO_NUMBER; num++) {
        if (!usedNumbers.has(num)) {
          placer.push({ num, count: 0, episode: -1 });
        }
      }
    }

    placer.sort((a, b) => {
      if (a.count !== b.count) return a.count - b.count;
      return a.episode - b.episode;
    });

    result[i] = placer[0].num;

    const placeCount = getPlaceCount(rank);

    const placeLimit = Math.min(placer.length, placeCount);
    for (let place = 0; place < placeLimit; place++) {
      usedNumbers.add(placer[place].num);
    }
  }

  result.sort((a, b) => a - b);

  return Promise.resolve(result);
};
