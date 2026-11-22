import { GeminiService } from './gemini.service';

describe('GeminiService', () => {
  let service: GeminiService;

  beforeEach(() => {
    service = new GeminiService();
  });

  it('should assemble structured prompt with blogger persona, best pick and hactto guides', () => {
    const prompt = service.buildLottoBriefingPrompt({
      round: 1150,
      winningNumbers: [4, 8, 18, 24, 37, 45],
      bonusNumber: 7,
      oddEvenRatio: '3:3',
      sumRange: 136,
      analyzedGames: [
        {
          label: '게임 A',
          numbers: [3, 8, 19, 24, 33, 42],
          matchWithPrevious: 2,
        },
        {
          label: '게임 B',
          numbers: [4, 18, 25, 29, 37, 45],
          matchWithPrevious: 4,
        },
        {
          label: '게임 C',
          numbers: [7, 14, 21, 28, 35, 44],
          matchWithPrevious: 0,
        },
      ],
      bestPickGame: {
        label: '게임 B',
        numbers: [4, 18, 25, 29, 37, 45],
        reason:
          '직전 1150회차 당첨번호 중 3개 구간 번호대 일치 및 짝수 집중 흐름 계승',
      },
    });

    expect(prompt).toContain('1150회');
    expect(prompt).toContain('파워블로거');
    expect(prompt).toContain('핵또');
    expect(prompt).toContain('원픽');
    expect(prompt).toContain('게임 B');
    expect(prompt).toContain('면책 조항');
  });

  it('should parse markdown header as title', async () => {
    const globalFetch = global.fetch;
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: '# [1150회 복기] 핵또 AI가 엄선한 이번 주 원픽 번호 대공개!\n\n안녕하세요 핵또 AI 분석관입니다.',
              },
            ],
          },
        },
      ],
    };

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    process.env.GEMINI_API_KEY = 'test-key';
    const result = await service.generateBriefing({
      round: 1150,
      winningNumbers: [1, 2, 3, 4, 5, 6],
      bonusNumber: 7,
      oddEvenRatio: '3:3',
      sumRange: 21,
      analyzedGames: [],
      bestPickGame: {
        label: '게임 A',
        numbers: [1, 2, 3, 4, 5, 6],
        reason: '동일',
      },
    });

    expect(result.title).toBe(
      '[1150회 복기] 핵또 AI가 엄선한 이번 주 원픽 번호 대공개!',
    );
    expect(result.content).toBe('안녕하세요 핵또 AI 분석관입니다.');

    global.fetch = globalFetch;
  });
});
