import { Injectable, Logger } from '@nestjs/common';

export interface LottoBriefingContext {
  round: number;
  winningNumbers: number[];
  bonusNumber: number;
  oddEvenRatio: string;
  sumRange: number;
  analyzedGames: Array<{
    label: string;
    numbers: number[];
    matchWithPrevious: number;
  }>;
  bestPickGame: { label: string; numbers: number[]; reason: string };
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly primaryModel =
    process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  private readonly fallbackModel = 'gemini-3.5-flash';

  buildLottoBriefingPrompt(ctx: LottoBriefingContext): string {
    return `
당신은 네이버/티스토리 로또·통계 분야의 인기 파워블로거이자 핵또(Hactto)의 공식 크리에이터인 [핵또 AI 분석관]입니다!
독자들과 친근하게 대화하듯 흡입력 있고 재미있으면서도, 알찬 데이터 분석과 인사이트를 제공하는 [주간 로또 복기 & 노하우 칼럼]을 마크다운 포맷으로 작성해 주세요.

[이번 주 회차 데이터]
- 직전 회차: 제 ${ctx.round}회 로또 추첨 결과
- 당첨 번호: [ ${ctx.winningNumbers.join(', ')} ] + 보너스 볼 [ ${ctx.bonusNumber} ]
- 홀짝 비율: ${ctx.oddEvenRatio} (합계: ${ctx.sumRange})
- 이번 주 다각도 분석 5개 조합:
${ctx.analyzedGames.map((g) => `  * ${g.label}: [ ${g.numbers.join(', ')} ] (직전 회차와 유사 번호대/패턴 ${g.matchWithPrevious}개 일치)`).join('\n')}
- **★ 이번 주 AI의 원픽(One-Pick) 추천 조합**: [ ${ctx.bestPickGame.label} ] -> [ ${ctx.bestPickGame.numbers.join(', ')} ]
  - 원픽 선정 사유: ${ctx.bestPickGame.reason}

[블로그 포스팅 작성 가이드라인]
1. **헤드라인 (Title)**:
   - 파워블로거 특유의 호기심을 자극하고 친근한 제목
   - 예: "🔥 [${ctx.round}회 복기] 지난주 번호와 가장 닮은 이번 주 원픽은? 핵또 AI가 분석한 다음 회차 필터링 팁!"

2. **도입부 (Intro)**:
   - "안녕하세요, 로또를 데이터로 재미있게 푸는 핵또 AI 분석관입니다! 👋" 로 밝고 에너지 넘치게 시작.
   - 지난주 ${ctx.round}회차 추첨 결과에 대한 가벼운 코멘트와 독자들의 안부 인사.

3. **1부: 지난 회차 핵심 패턴 3분 요약**:
   - 홀짝 밸런스, 총합 구간, 연번(연속번호) 유무 등 이번 회차에서 눈에 띈 특이점 브리핑.

4. **2부: 이번 주 AI의 원픽(One-Pick) 조합 & 선정 근거 대공개**:
   - 추출한 여러 게임 중 왜 [${ctx.bestPickGame.label}] 조합이 지난주 당첨 번호의 흐름과 가장 닮았는지/왜 유의미한지 통계적 근거(번호대 구간 분포, 끝수 패턴 등)를 흥미진진하게 해설.

5. **3부: 꿀팁! 핵또(Hactto) 사이트 제대로 200% 활용하는 법**:
   - 독자들에게 핵또 사이트의 실질적 활용 팁 안내:
     * 💡 [번호 생성기]: 이번 원픽 번호에 나만의 고정수나 제외수를 넣어 나만의 맞춤 게임 만들기
     * 📊 [통계 차트 / 볼 분석]: 특정 번호가 최근 몇 주 동안 미출현했는지 직접 눈으로 확인하기
     * 🏆 [노하우 게시판]: 여러분만의 분석 가설이나 이번 주 느낌 좋은 번호를 댓글로 공유해보기

6. **마무리 및 독자 참여 유도**:
   - "여러분이 보시기에 이번 주 가장 매력적인 번호는 몇 번인가요? 댓글로 자유롭게 남겨주세요!"
   - 하단 필수 면책 고지 배너:
     > [!NOTE] 면책 조항: 본 칼럼은 과거 통계 데이터와 알고리즘에 기반한 순수 엔터테인먼트/분석 콘텐츠입니다. 로또 추첨은 완전한 독립 확률 시행이며 당첨을 보장하지 않습니다. 건전한 복권 문화를 응원합니다!
    `.trim();
  }

  private async callGeminiApi(
    model: string,
    apiKey: string,
    prompt: string,
  ): Promise<Response> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 3000,
        },
      }),
      signal: AbortSignal.timeout(20000),
    });
  }

  async generateBriefing(
    ctx: LottoBriefingContext,
  ): Promise<{ title: string; content: string }> {
    const apiKey = this.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured in environment variables.',
      );
    }

    const prompt = this.buildLottoBriefingPrompt(ctx);
    let targetModel = this.primaryModel;
    let response = await this.callGeminiApi(targetModel, apiKey, prompt);

    // If primary model experiences temporary outage (503), not found (404), or rate limits (429), try fallback model
    if (
      !response.ok &&
      (response.status === 503 ||
        response.status === 404 ||
        response.status === 429) &&
      this.primaryModel !== this.fallbackModel
    ) {
      this.logger.warn(
        `Gemini API failed with status ${response.status} using model ${this.primaryModel}. Falling back to ${this.fallbackModel}...`,
      );
      targetModel = this.fallbackModel;
      response = await this.callGeminiApi(targetModel, apiKey, prompt);
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Gemini API error (${targetModel}): ${response.status} - ${errText}`,
      );
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const lines = rawText.split('\n');
    let title = `🔥 [${ctx.round}회 분석] 직전 당첨번호와 가장 닮은 이번 주 원픽 & 핵또 활용법!`;
    let content = rawText;

    const titleLine = lines.find((l: string) => l.startsWith('# '));
    if (titleLine) {
      title = titleLine.replace(/^#\s*/, '').trim();
      content = lines
        .filter((l: string) => l !== titleLine)
        .join('\n')
        .trim();
    }

    return { title, content };
  }
}
