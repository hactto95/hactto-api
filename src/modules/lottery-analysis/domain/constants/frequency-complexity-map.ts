import { AlgorithmMetadata } from './algorithm-metadata';
import { FrequencyType } from '../enums/frequency-type';

export const FrequencyComplexityMap: Record<FrequencyType, AlgorithmMetadata> =
  {
    [FrequencyType.PAIR_FREQUENCY]: { complexity: 2 },
    [FrequencyType.RECENT_PAIR_FREQUENCY]: { complexity: 2 },
    [FrequencyType.TRIPLET_FREQUENCY]: { complexity: 3 },
    [FrequencyType.RECENT_TRIPLET_FREQUENCY]: { complexity: 3 },
  };
