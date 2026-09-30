import { BalanceFunction } from './balance-function';
import { sumOddEvenBalance } from './sum-odd-even-balance';

export const recentSumOddEvenBalance: BalanceFunction = (
  data: number[][],
  oddCount?: number,
): Promise<number[]> => {
  if (data.length === 0) return Promise.resolve([]);
  if (oddCount === 0) oddCount = 3;

  const RECENT_EPISODE_COUNT = 50;

  const recentData = data.slice(-Math.min(data.length, RECENT_EPISODE_COUNT));

  return sumOddEvenBalance(recentData, oddCount);
};
