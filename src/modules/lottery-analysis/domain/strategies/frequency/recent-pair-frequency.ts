import { FrequencyFunction } from './frequency-function';
import { pairFrequency } from './pair-frequency';

export const recentPairFrequency: FrequencyFunction = (
  data: number[][],
): Promise<number[]> => {
  if (data.length === 0) return Promise.resolve([]);

  const RECENT_EPISODE_COUNT = 50;

  const recentData = data.slice(-Math.min(data.length, RECENT_EPISODE_COUNT));

  return pairFrequency(recentData);
};
