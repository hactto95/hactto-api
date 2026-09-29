import { FrequencyFunction } from './frequency-function';

export const tripletFrequency: FrequencyFunction = (
  data: number[][],
): Promise<number[]> => {
  if (data.length === 0) return Promise.resolve([]);

  const tripletScore: Map<string, number> = new Map();

  for (const draw of data) {
    const numbers = draw.slice(0, 6);

    for (let i = 0; i < numbers.length - 2; i++) {
      for (let j = i + 1; j < numbers.length - 1; j++) {
        for (let k = j + 1; k < numbers.length; k++) {
          const tripletKey = `${numbers[i]},${numbers[j]},${numbers[k]}`;

          const count = tripletScore.get(tripletKey) || 0;
          tripletScore.set(tripletKey, count + 1);
        }
      }
    }
  }

  const tripletList = Array.from(tripletScore.entries()).map(
    ([tripletStr, count]) => ({
      triplet: tripletStr.split(',').map(Number),
      count,
    }),
  );

  for (let i = tripletList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tripletList[i], tripletList[j]] = [tripletList[j], tripletList[i]];
  }

  const sortedTriplets = tripletList.sort((a, b) => b.count - a.count);

  const result: Set<number> = new Set();

  for (const item of sortedTriplets) {
    const [num1, num2, num3] = item.triplet;

    if (result.size >= 6) break;

    if (result.size < 6) result.add(num1);
    if (result.size < 6) result.add(num2);
    if (result.size < 6) result.add(num3);
  }

  if (result.size < 6) {
    for (const item of sortedTriplets) {
      for (const num of item.triplet) {
        if (result.size >= 6) break;
        result.add(num);
      }
    }
  }

  return Promise.resolve(
    Array.from(result)
      .slice(0, 6)
      .sort((a, b) => a - b),
  );
};
