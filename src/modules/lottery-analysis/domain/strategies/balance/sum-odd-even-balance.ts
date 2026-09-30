import { BalanceFunction } from './balance-function';
import { sumBalance } from './sum-balance';

export const sumOddEvenBalance: BalanceFunction = async (
  data: number[][],
  oddCount?: number,
): Promise<number[]> => {
  if (data.length === 0) return Promise.resolve([]);
  if (oddCount === undefined) oddCount = 3;

  let result: number[] = [];

  let attempts = 0;
  const MAX_ATTEMPTS = 10000;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;

    result = await sumBalance(data);

    let odds = 0;
    for (const num of result) {
      if (num % 2 === 1) odds++;
    }
    if (odds === oddCount) break;
  }

  return result.sort((a, b) => a - b);
};
