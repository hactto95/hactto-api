import { FrequencyFunction } from './frequency-function';

export const pairFrequency: FrequencyFunction = (
  data: number[][],
): Promise<number[]> => {
  if (data.length === 0) return Promise.resolve([]);

  const pairScore: Map<string, number> = new Map();

  for (const draw of data) {
    const numbers = draw.slice(0, 6);

    for (let i = 0; i < numbers.length - 1; i++) {
      for (let j = i + 1; j < numbers.length; j++) {
        const pairKey = `${numbers[i]},${numbers[j]}`;

        const count = pairScore.get(pairKey) || 0;
        pairScore.set(pairKey, count + 1);
      }
    }
  }

  const pairList = Array.from(pairScore.entries()).map(([pairStr, count]) => ({
    pair: pairStr.split(',').map(Number),
    count,
  }));

  for (let i = pairList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairList[i], pairList[j]] = [pairList[j], pairList[i]];
  }

  const sortedPairs = pairList.sort((a, b) => b.count - a.count);

  const result: Set<number> = new Set();

  for (const item of sortedPairs) {
    const [num1, num2] = item.pair;

    if (result.size >= 6) break;

    if (!result.has(num1) && !result.has(num2)) {
      if (result.size <= 4) {
        result.add(num1);
        result.add(num2);
      } else {
        const random = Math.random() < 0.5 ? num1 : num2;
        result.add(random);
      }
    } else if (!result.has(num1)) {
      result.add(num1);
    } else if (!result.has(num2)) {
      result.add(num2);
    }
  }

  if (result.size < 6) {
    for (const item of sortedPairs) {
      if (result.size >= 6) break;
      result.add(item.pair[0]);
      if (result.size >= 6) break;
      result.add(item.pair[1]);
    }
  }

  return Promise.resolve(
    Array.from(result)
      .slice(0, 6)
      .sort((a, b) => a - b),
  );
};
