export type WeightsFunction = (
  data: number[][],
  weights: number[],
) => Promise<number[]>;
