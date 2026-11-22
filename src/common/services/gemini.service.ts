import { Injectable, Logger } from '@nestjs/common';

export interface AnalyzedGameInfo {
  label: string;
  numbers: number[];
  matchWithPrevious: number;
  sourceType: 'ALGORITHM' | 'HISTORICAL_PATTERN' | 'HYBRID';
  sourceName: string;
  description: string;
}

export interface LottoBriefingContext {
  round: number;
  winningNumbers: number[];
  bonusNumber: number;
  oddEvenRatio: string;
  sumRange: number;
  recentHotNumbers?: number[];
  recentColdNumbers?: number[];
  analyzedGames: AnalyzedGameInfo[];
  bestPickGame: {
    label: string;
    numbers: number[];
    sourceName: string;
    reason: string;
  };
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly primaryModel =
    process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  private readonly fallbackModel = 'gemini-3.5-flash';

  buildLottoBriefingPrompt(ctx: LottoBriefingContext): string {
    const hotListStr =
      ctx.recentHotNumbers && ctx.recentHotNumbers.length > 0
        ? ctx.recentHotNumbers.join(', ')
        : '집계 중';
    const coldListStr =
      ctx.recentColdNumbers && ctx.recentColdNumbers.length > 0
        ? ctx.recentColdNumbers.join(', ')
        : '집계 중';

    return `
당신은 네이버/티스토리 로또·통계 분야의 인기 파워블로거이자 핵또(Hactto)의 공식 크리에이터인 [핵또 AI 분석관]입니다!
독자들과 친근하게 대화하듯 흡입력 있고 재미있으면서도, 알찬 데이터 분석과 실전 노하우를 가득 담은 [주간 로또 복기 & AI 추천 노하우 칼럼]을 작성해 주세요.

[이번 주 회차 데이터]
- 직전 회차: 제 ${ctx.round}회 로또 추첨 결과
- 당첨 번호: [ ${ctx.winningNumbers.join(', ')} ] + 보너스 볼 [ ${ctx.bonusNumber} ]
- 홀짝 비율: ${ctx.oddEvenRatio} (당첨 번호 총합: ${ctx.sumRange})
- 최근 5회차 다출현 HOT 볼: [ ${hotListStr} ]
- 최근 5회차 장기 미출현 COLD 볼: [ ${coldListStr} ]

- 이번 주 추천 분석 5개 조합 (게임 A ~ E):
${ctx.analyzedGames
  .map(
    (g) =>
      `  * ${g.label}: [ ${g.numbers.join(', ')} ]\n` +
      `    - 추출 방식: [${g.sourceName}] (직전 회차와 ${g.matchWithPrevious}개 일치/유사)\n` +
      `    - 추출 배경: ${g.description}`,
  )
  .join('\n')}

- 이번 주 AI의 원픽(One-Pick) 추천 조합: [ ${ctx.bestPickGame.label} ] -> [ ${ctx.bestPickGame.numbers.join(', ')} ]
  - 원픽 알고리즘/분석 출처: ${ctx.bestPickGame.sourceName}
  - 원픽 선정 사유: ${ctx.bestPickGame.reason}

[블로그 포스팅 작성 가이드라인 - 필독]
- 절대적 필수 조건:
  1. 글이 중간에 잘리거나 끊기지 않도록 분량을 적절히 조절하여, 도입부부터 1부, 2부, 3부, 마무리 및 면책 조항까지 반드시 완전한 문장으로 끝까지 완성해 주세요.
  2. 우리 게시판은 일반 텍스트 게시판이므로 **, ##, ###, ---, > [!NOTE], *기울임* 같은 마크다운 서식 기호는 절대 사용하지 마세요.
  3. 제목과 본문 전체에서 기본 이모지(유니코드 이모지)는 절대 사용하지 마세요. 소제목과 강조는 대괄호([ ]), 줄바꿈, 숫자(1., 2.), 하이픈(-)만으로 가독성 높게 표현해 주세요.

[본문 필수 구성 요소]
1. 헤드라인 (Title):
   - 글의 가장 첫 번째 줄에 "제목: "으로 시작하여 독자의 호기심을 자극하고 친근한 제목을 작성해 주세요.
   - 예: 제목: [${ctx.round}회 복기] 핵또 통계 알고리즘과 직전 패턴 분석이 결합된 이번 주 AI 원픽 번호 공개!

2. 도입부 (Intro):
   - "안녕하세요, 로또를 데이터로 재미있게 푸는 핵또 AI 분석관입니다!"로 활기차게 시작.
   - 지난 ${ctx.round}회차 추첨 결과에 대한 짧은 소회와 독자들을 향한 따뜻한 안부 인사.

3. [1부] 직전 ${ctx.round}회 핵심 패턴 3분 요약 & 통계 인사이트:
   - 홀짝 밸런스(${ctx.oddEvenRatio}), 총합(${ctx.sumRange}), 연번 유무, 번호대별 쏠림(단번대, 10번대, 20번대, 30번대, 40번대) 분석.
   - 최근 5회차 HOT 볼과 COLD 볼의 흐름을 짚어주며 다음 회차에서 주목할 핵심 흐름 제시.

4. [2부] 이번 주 AI 5개 조합(게임 A~E) 추출 배경 & AI 원픽(One-Pick) 대공개:
   - 각 게임(A부터 E까지)마다 이 번호가 "어떤 핵또 알고리즘(예: 총합 밸런스, 열번호 가중치, 동반출현 페어 등)을 통해 추출되었는지" 또는 "직전 회차/최근 회차의 어떤 패턴(보너스볼 이월수, 미출현 반등 등)을 분석하여 도출되었는지" 명확하게 밝혀주세요.
   - 특히 AI가 선정한 [${ctx.bestPickGame.label}] 원픽 번호에 대해서는, "핵또 통계 알고리즘의 수치적 예측"과 "이전 회차 패턴 분석(이월수, 홀짝 균형, 끝수 다양성)"을 어떻게 조화롭게 조합하여 최종 낙점했는지 깊이 있는 노하우를 상세히 설명해 주세요.

5. [3부] 핵또(Hactto) 200% 활용 노하우:
   - 독자들이 핵또 사이트 기능을 직접 활용해 전략을 세울 수 있도록 실전 팁 안내:
     - [번호 생성기]: 이번 AI 추천 번호에 개인의 고정수/제외수를 조합해 나만의 맞춤 조합 생성
     - [통계 차트 / 볼 분석]: 최근 회차 미출현 번호와 자리별 출현 통계를 직접 비교해보기
     - [노하우 게시판]: 독자분들만의 가설이나 느낌 좋은 번호를 댓글로 공유하고 의견 나누기

6. 마무리 및 면책 조항:
   - 독자 댓글 소통 유도 ("여러분이 보시기에 이번 주 가장 눈길이 가는 번호는 무엇인가요?")
   - 하단 면책 조항 필수 포함:
     [면책 조항] 본 칼럼은 과거 공공 통계 데이터와 알고리즘에 기반한 순수 엔터테인먼트/분석 콘텐츠입니다. 로또 추첨은 완전한 독립 확률 시행이며 당첨을 보장하지 않습니다. 건전한 복권 문화를 응원합니다!
`.trim();
  }

  private stripMarkdown(text: string): string {
    return text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^>\s*\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/gim, '')
      .replace(/^>\s?/gm, '')
      .replace(/^-{3,}\s*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
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
          temperature: 0.7,
          maxOutputTokens: 8192,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      }),
      signal: AbortSignal.timeout(45000),
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
    const candidate = data?.candidates?.[0];
    const rawText = candidate?.content?.parts?.[0]?.text || '';

    if (candidate?.finishReason === 'MAX_TOKENS') {
      this.logger.warn(
        'Gemini response hit MAX_TOKENS limit! Output might be truncated.',
      );
    }

    const lines = rawText.split('\n');
    let title = `[${ctx.round}회 분석] 직전 당첨번호와 가장 닮은 이번 주 원픽 & 핵또 활용법!`;
    let content = rawText;

    const titleLine = lines.find(
      (l: string) => l.trim().startsWith('# ') || l.trim().startsWith('제목:'),
    );
    if (titleLine) {
      title = titleLine.replace(/^\s*(?:#\s*|제목:\s*)/, '').trim();
      content = lines
        .filter((l: string) => l !== titleLine)
        .join('\n')
        .trim();
    }

    title = this.stripMarkdown(title);
    content = this.stripMarkdown(content);

    return { title, content };
  }
}
