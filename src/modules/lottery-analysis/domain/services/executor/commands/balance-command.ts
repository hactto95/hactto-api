import { ExecutableCommand } from './executable-command';
import { BalanceType } from '../../../enums/balance-type';
import { sumBalance } from '../../../strategies/balance/sum-balance';
import { sumOddEvenBalance } from '../../../strategies/balance/sum-odd-even-balance';
import { recentSumOddEvenBalance } from '../../../strategies/balance/recent-sum-odd-even-balance';
import { recentSumBalance } from '../../../strategies/balance/recent-sum-balance';

export class BalanceCommand implements ExecutableCommand {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private static registry: Record<BalanceType, Function> = {
    [BalanceType.SUM_BALANCE]: sumBalance,
    [BalanceType.RECENT_SUM_BALANCE]: recentSumBalance,
    [BalanceType.SUM_ODD_EVEN_BALANCE]: sumOddEvenBalance,
    [BalanceType.RECENT_SUM_ODD_EVEN_BALANCE]: recentSumOddEvenBalance,
  };

  constructor(
    private type: `${BalanceType}`,
    private data: number[][],
    private oddCount?: number,
  ) {}

  async execute(): Promise<number[]> {
    const algorithm = BalanceCommand.registry[this.type as BalanceType];
    if (!algorithm) throw new Error(`Unsupported algorithm: ${this.type}`);
    return await algorithm(this.data, this.oddCount);
  }
}
