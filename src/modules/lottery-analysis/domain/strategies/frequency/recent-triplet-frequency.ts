import { FrequencyFunction } from './frequency-function';
import { tripletFrequency } from './triplet-frequency';

export const recentTripletFrequency: FrequencyFunction = (
  data: number[][],
): Promise<number[]> => {
  if (data.length === 0) return Promise.resolve([]);

  const RECENT_EPISODE_COUNT = 50;

  const recentData = data.slice(-Math.min(data.length, RECENT_EPISODE_COUNT));

  return tripletFrequency(recentData);
};
