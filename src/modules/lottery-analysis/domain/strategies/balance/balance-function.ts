export type BalanceFunction = (
  data: number[][],
  oddCount?: number,
) => Promise<number[]>;
