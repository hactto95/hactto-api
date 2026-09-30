import { BalanceType } from '../enums/balance-type';
import { AlgorithmMetadata } from './algorithm-metadata';

export const BalanceComplexityMap: Record<BalanceType, AlgorithmMetadata> = {
  [BalanceType.SUM_BALANCE]: { complexity: 2 },
  [BalanceType.RECENT_SUM_BALANCE]: { complexity: 2 },
  [BalanceType.SUM_ODD_EVEN_BALANCE]: { complexity: 3 },
  [BalanceType.RECENT_SUM_ODD_EVEN_BALANCE]: { complexity: 3 },
};
