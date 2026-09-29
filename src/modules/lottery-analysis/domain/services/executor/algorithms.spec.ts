import { WeightsCommand } from './commands/weights-command';
import { hacttoExecute } from './hactto-execute';
import { FrequencyCommand } from './commands/frequency-command';
import { BalanceCommand } from './commands/balance-command';

const data = [
  [4, 7, 18, 23, 29, 41, 3],
  [1, 7, 12, 18, 33, 45, 22],
  [4, 11, 18, 25, 29, 42, 7],
  [2, 9, 14, 23, 31, 38, 41],
  [7, 12, 19, 23, 29, 40, 15],
  [1, 4, 18, 29, 35, 44, 20],
  [11, 18, 22, 29, 33, 41, 13],
  [7, 23, 29, 31, 33, 45, 8],
];
const weights = [25, 20, 18, 15, 12, 10];

describe('Hactto 알고리즘 실행 결과 확인', () => {
  it('==================================================', () => {});
  it('- Weights 알고리즘', () => {});
  it('==================================================', () => {});

  it('1. MIN_COUNT 결과', async () => {
    const command = new WeightsCommand('MIN_COUNT_WEIGHTS', data, weights);

    const result = await hacttoExecute(command);

    console.log('👉 [MIN_COUNT] 결과:', result);
    console.log('--------------------------------------------------');
  });

  it('2. TOTAL_MIN_COUNT 결과', async () => {
    const command = new WeightsCommand(
      'TOTAL_MIN_COUNT_WEIGHTS',
      data,
      weights,
    );

    const result = await hacttoExecute(command);

    console.log('👉 [TOTAL_MIN_COUNT] 결과:', result);
    console.log('--------------------------------------------------');
  });

  it('3. RECENT_MIN_COUNT 결과', async () => {
    const command = new WeightsCommand(
      'RECENT_MIN_COUNT_WEIGHTS',
      data,
      weights,
    );

    const result = await hacttoExecute(command);

    console.log('👉 [RECENT_MIN_COUNT] 결과:', result);
    console.log('--------------------------------------------------');
  });

  it('4. MAX_COUNT 결과', async () => {
    const command = new WeightsCommand('MAX_COUNT_WEIGHTS', data, weights);

    const result = await hacttoExecute(command);

    console.log('👉 [MAX_COUNT] 결과:', result);
    console.log('--------------------------------------------------');
  });

  it('5. TOTAL_MAX_COUNT 결과', async () => {
    const command = new WeightsCommand(
      'TOTAL_MAX_COUNT_WEIGHTS',
      data,
      weights,
    );

    const result = await hacttoExecute(command);

    console.log('👉 [TOTAL_MAX_COUNT] 결과:', result);
    console.log('--------------------------------------------------');
  });

  it('6. RECENT_MAX_COUNT 결과', async () => {
    const command = new WeightsCommand(
      'RECENT_MAX_COUNT_WEIGHTS',
      data,
      weights,
    );

    const result = await hacttoExecute(command);

    console.log('👉 [RECENT_MAX_COUNT] 결과:', result);
    console.log('--------------------------------------------------');
  });

  it('==================================================', () => {});
  it('- Frequency 알고리즘', () => {});
  it('==================================================', () => {});

  it('1. PAIR_FREQUENCY 결과', async () => {
    const command = new FrequencyCommand('PAIR_FREQUENCY', data);

    const result = await hacttoExecute(command);

    console.log('👉 [PAIR_FREQUENCY] 결과:', result);
    console.log('--------------------------------------------------');
  });

  it('2. RECENT_PAIR_FREQUENCY 결과', async () => {
    const command = new FrequencyCommand('RECENT_PAIR_FREQUENCY', data);

    const result = await hacttoExecute(command);

    console.log('👉 [RECENT_PAIR_FREQUENCY] 결과:', result);
    console.log('--------------------------------------------------');
  });

  it('3. TRIPLET_FREQUENCY 결과', async () => {
    const command = new FrequencyCommand('TRIPLET_FREQUENCY', data);

    const result = await hacttoExecute(command);

    console.log('👉 [TRIPLET_FREQUENCY] 결과:', result);
    console.log('--------------------------------------------------');
  });

  it('4. RECENT_TRIPLET_FREQUENCY 결과', async () => {
    const command = new FrequencyCommand('RECENT_TRIPLET_FREQUENCY', data);

    const result = await hacttoExecute(command);

    console.log('👉 [RECENT_TRIPLET_FREQUENCY] 결과:', result);
    console.log('--------------------------------------------------');
  });

  it('==================================================', () => {});
  it('- Balance 알고리즘', () => {});
  it('==================================================', () => {});

  it('1. SUM_BALANCE 결과', async () => {
    const command = new BalanceCommand('SUM_BALANCE', data);

    const result = await hacttoExecute(command);

    console.log('👉 [SUM_BALANCE] 결과:', result);
    console.log('--------------------------------------------------');
  });

  it('2. RECENT_SUM_BALANCE 결과', async () => {
    const command = new BalanceCommand('RECENT_SUM_BALANCE', data);

    const result = await hacttoExecute(command);

    console.log('👉 [RECENT_SUM_BALANCE] 결과:', result);
    console.log('--------------------------------------------------');
  });

  it('3. SUM_ODD_EVEN_BALANCE 결과', async () => {
    const command = new BalanceCommand('SUM_ODD_EVEN_BALANCE', data, 2);

    const result = await hacttoExecute(command);

    console.log('👉 [SUM_ODD_EVEN_BALANCE] 결과:', result);
    console.log('--------------------------------------------------');
  });

  it('4. RECENT_SUM_ODD_EVEN_BALANCE 결과', async () => {
    const command = new BalanceCommand('RECENT_SUM_ODD_EVEN_BALANCE', data, 2);

    const result = await hacttoExecute(command);

    console.log('👉 [RECENT_SUM_ODD_EVEN_BALANCE] 결과:', result);
    console.log('--------------------------------------------------');
  });
});
