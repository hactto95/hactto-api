import { WeightsType } from '../../enums/weights-type';
import { WeightsComplexityMap } from '../../constants/weights-complexity-map';
import { FrequencyType } from '../../enums/frequency-type';
import { FrequencyComplexityMap } from '../../constants/frequency-complexity-map';
import { BalanceType } from '../../enums/balance-type';
import { BalanceComplexityMap } from '../../constants/balance-complexity-map';

export function getAlgorithm(): { type: string; complexity: number }[] {
  const weightsTypes: WeightsType[] = Object.values(WeightsType);
  const weightsTypesData = weightsTypes.map((type) => ({
    type,
    complexity: WeightsComplexityMap[type].complexity,
  }));
  const frequencyTypes: FrequencyType[] = Object.values(FrequencyType);
  const frequencyTypesData = frequencyTypes.map((type) => ({
    type,
    complexity: FrequencyComplexityMap[type].complexity,
  }));
  const balanceTypes: BalanceType[] = Object.values(BalanceType);
  const balanceTypesData = balanceTypes.map((type) => ({
    type,
    complexity: BalanceComplexityMap[type].complexity,
  }));
  return [...weightsTypesData, ...frequencyTypesData, ...balanceTypesData];
}
