import { BalanceFunction } from './balance-function';
import { sumBalance } from './sum-balance';

export const recentSumBalance: BalanceFunction = (
  data: number[][],
): Promise<number[]> => {
  if (data.length === 0) return Promise.resolve([]);

  const RECENT_EPISODE_COUNT = 50;

  const recentData = data.slice(-Math.min(data.length, RECENT_EPISODE_COUNT));

  return sumBalance(recentData);
};
