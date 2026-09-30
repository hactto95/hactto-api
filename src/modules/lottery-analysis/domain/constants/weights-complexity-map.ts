import { AlgorithmMetadata } from './algorithm-metadata';
import { WeightsType } from '../enums/weights-type';

export const WeightsComplexityMap: Record<WeightsType, AlgorithmMetadata> = {
  [WeightsType.MIN_COUNT_WEIGHTS]: { complexity: 1 },
  [WeightsType.TOTAL_MIN_COUNT_WEIGHTS]: { complexity: 1 },
  [WeightsType.RECENT_MIN_COUNT_WEIGHTS]: { complexity: 1 },
  [WeightsType.MAX_COUNT_WEIGHTS]: { complexity: 1 },
  [WeightsType.TOTAL_MAX_COUNT_WEIGHTS]: { complexity: 1 },
  [WeightsType.RECENT_MAX_COUNT_WEIGHTS]: { complexity: 1 },
};
