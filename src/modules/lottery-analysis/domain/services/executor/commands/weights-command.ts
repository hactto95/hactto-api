import { ExecutableCommand } from './executable-command';
import { WeightsType } from '../../../enums/weights-type';
import { totalMinCountWeights } from '../../../strategies/weights/total-min-count-weights';
import { minCountWeights } from '../../../strategies/weights/min-count-weights';
import { recentMinCountWeights } from '../../../strategies/weights/recent-min-count-weights';
import { maxCountWeights } from '../../../strategies/weights/max-count-weights';
import { totalMaxCountWeights } from '../../../strategies/weights/total-max-count-weights';
import { recentMaxCountWeights } from '../../../strategies/weights/recent-max-count-weights';

export class WeightsCommand implements ExecutableCommand {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private static registry: Record<WeightsType, Function> = {
    [WeightsType.MIN_COUNT_WEIGHTS]: minCountWeights,
    [WeightsType.TOTAL_MIN_COUNT_WEIGHTS]: totalMinCountWeights,
    [WeightsType.RECENT_MIN_COUNT_WEIGHTS]: recentMinCountWeights,
    [WeightsType.MAX_COUNT_WEIGHTS]: maxCountWeights,
    [WeightsType.TOTAL_MAX_COUNT_WEIGHTS]: totalMaxCountWeights,
    [WeightsType.RECENT_MAX_COUNT_WEIGHTS]: recentMaxCountWeights,
  };

  constructor(
    private type: `${WeightsType}`,
    private data: number[][],
    private weights: number[],
  ) {}

  async execute(): Promise<number[]> {
    const algorithm = WeightsCommand.registry[this.type as WeightsType];
    if (!algorithm) throw new Error(`Unsupported algorithm: ${this.type}`);
    return await algorithm(this.data, this.weights);
  }
}
