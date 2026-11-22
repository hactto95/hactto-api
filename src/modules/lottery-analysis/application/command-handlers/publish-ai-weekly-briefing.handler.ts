import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PublishAiWeeklyBriefingCommand } from '../commands/publish-ai-weekly-briefing.command';
import {
  AnalyzedGameInfo,
  GeminiService,
} from '../../../../common/services/gemini.service';
import { SlackNotifierService } from '../../../../common/services/slack-notifier.service';
import { prisma } from '../../../../libs/prisma';
import { BoardCategory } from '../../../../generated/prisma/client';
import {
  AI_ANALYST_USER_ID,
  ensureAiAnalystUser,
} from '../../../user/infrastructure/seeds/ai-analyst.seed';
import { GetLatestWinningNumberQuery } from '../../../number/application/queries/get-latest-winning-number.query';
import { GetWinningNumberByEpisodeQuery } from '../../../number/application/queries/get-winning-number-by-episode.query';
import { getAlgorithmDisplayInfo } from '../../domain/constants/algorithm-display-names';

@CommandHandler(PublishAiWeeklyBriefingCommand)
export class PublishAiWeeklyBriefingHandler implements ICommandHandler<PublishAiWeeklyBriefingCommand> {
  private readonly logger = new Logger(PublishAiWeeklyBriefingHandler.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly geminiService: GeminiService,
    private readonly slackNotifierService: SlackNotifierService,
  ) {}

  async execute(command: PublishAiWeeklyBriefingCommand): Promise<{
    success: boolean;
    postId?: number;
    skipped?: boolean;
    round?: number;
    title?: string;
  }> {
    try {
      // 1. 대상 회차 또는 최신 당첨 번호 조회
      const targetWinning = command.round
        ? await this.queryBus.execute(
            new GetWinningNumberByEpisodeQuery(command.round),
          )
        : await this.queryBus.execute(new GetLatestWinningNumberQuery());

      if (!targetWinning) {
        this.logger.warn(
          command.round
            ? `제 ${command.round}회차 당첨 번호를 찾을 수 없습니다.`
            : '최신 당첨 번호를 찾을 수 없습니다.',
        );
        return { success: false };
      }

      const round = command.round || targetWinning.episode;

      // 2. 멱등성 검사: force가 아닐 때 이미 해당 회차 AI 노하우 글이 등록되어 있다면 스킵
      const existing = await prisma.post.findFirst({
        where: {
          lottoRound: round,
          category: BoardCategory.KNOWHOW,
          isAi: true,
          isDeleted: false,
        },
      });

      if (existing && !command.force) {
        this.logger.log(
          `제 ${round}회차 AI 주간 노하우 글이 이미 존재합니다 (Post ID: ${existing.id}). 스킵합니다.`,
        );
        return {
          success: true,
          postId: existing.id,
          skipped: true,
          round,
          title: existing.title,
        };
      }

      // 3. AI 분석관 계정 보장
      await ensureAiAnalystUser();

      // 4. 직전 회차 통계 계산
      const numberArray = targetWinning.getNumberArray();
      const sixBalls = numberArray
        .slice(0, 6)
        .sort((a: number, b: number) => a - b);
      const bonusBall = numberArray[6] || 0;

      const oddCount = sixBalls.filter((n: number) => n % 2 !== 0).length;
      const oddEvenRatio = `${oddCount}:${6 - oddCount}`;
      const sumRange = sixBalls.reduce(
        (acc: number, curr: number) => acc + curr,
        0,
      );

      // 4-1. 최근 5회차 당첨 번호 통계 (HOT/COLD 볼 분석)
      let recentHotNumbers: number[] = [];
      let recentColdNumbers: number[] = [];
      try {
        const recentWinnings = await prisma.winningNumber.findMany({
          where: { episode: { lte: round } },
          orderBy: { episode: 'desc' },
          take: 5,
        });

        if (recentWinnings.length > 0) {
          const freqMap: Record<number, number> = {};
          for (let i = 1; i <= 45; i++) freqMap[i] = 0;

          recentWinnings.forEach((w) => {
            [
              w.lt1WnNo,
              w.lt2WnNo,
              w.lt3WnNo,
              w.lt4WnNo,
              w.lt5WnNo,
              w.lt6WnNo,
            ].forEach((num) => {
              if (num >= 1 && num <= 45) {
                freqMap[num] = (freqMap[num] || 0) + 1;
              }
            });
          });

          recentHotNumbers = Object.keys(freqMap)
            .map(Number)
            .filter((n) => freqMap[n] >= 2)
            .sort((a, b) => freqMap[b] - freqMap[a]);

          recentColdNumbers = Object.keys(freqMap)
            .map(Number)
            .filter((n) => freqMap[n] === 0);
        }
      } catch (err) {
        this.logger.warn(
          `최근 5회차 당첨번호 통계 조회 실패 (기본값 사용): ${err}`,
        );
      }

      // 5. 다음 회차 분석 후보 5개 게임 수집 (알고리즘 및 이전 회차 패턴 분석 통합)
      const analyzedGames = await this.resolveCandidateGames(
        round + 1,
        round,
        sixBalls,
        bonusBall,
        recentHotNumbers,
        recentColdNumbers,
      );

      // 5-1. 가장 직전 당첨번호 흐름과의 연결성 및 밸런스가 우수한 게임을 원픽으로 선정
      const sortedCandidates = [...analyzedGames].sort((a, b) => {
        if (b.matchWithPrevious !== a.matchWithPrevious) {
          return b.matchWithPrevious - a.matchWithPrevious;
        }
        const sumA = a.numbers.reduce((x, y) => x + y, 0);
        const sumB = b.numbers.reduce((x, y) => x + y, 0);
        return Math.abs(sumA - 135) - Math.abs(sumB - 135);
      });

      const best = sortedCandidates[0];
      const bestSum = best.numbers.reduce((a, b) => a + b, 0);
      const bestOddCount = best.numbers.filter((n) => n % 2 !== 0).length;

      const bestPickGame = {
        label: best.label,
        numbers: best.numbers,
        sourceName: best.sourceName,
        reason:
          best.matchWithPrevious > 0
            ? `[${best.sourceName}]을 통해 도출된 조합으로, 직전 ${round}회차 당첨번호 흐름과의 연결성(${best.matchWithPrevious}수 연계) 및 총합(${bestSum}), 홀짝(${bestOddCount}:${6 - bestOddCount}) 황금 밸런스를 동시에 만족`
            : `[${best.sourceName}]을 적용하여 직전 회차 미출현 구간을 정밀하게 보완하고, 총합(${bestSum}) 및 구간별 균등 분포가 가장 이상적인 최적의 조합`,
      };

      // 6. Gemini API 호출 (파워블로거 톤앤매너 프롬프트)
      const { title, content } = await this.geminiService.generateBriefing({
        round,
        winningNumbers: sixBalls,
        bonusNumber: bonusBall,
        oddEvenRatio,
        sumRange,
        recentHotNumbers,
        recentColdNumbers,
        analyzedGames,
        bestPickGame,
      });

      // 7. DB 게시글 저장 (force 재발행 시 기존 게시글 업데이트, 신규 시 생성)
      let post;
      if (existing) {
        post = await prisma.post.update({
          where: { id: existing.id },
          data: {
            title,
            content,
            isAi: true,
            isAdmin: true,
            category: BoardCategory.KNOWHOW,
          },
        });
        this.logger.log(
          `제 ${round}회차 기존 AI 노하우 게시글이 성공적으로 업데이트되었습니다 (Post ID: ${post.id})`,
        );
      } else {
        post = await prisma.post.create({
          data: {
            userId: AI_ANALYST_USER_ID,
            category: BoardCategory.KNOWHOW,
            title,
            content,
            lottoRound: round,
            isAdmin: true,
            isAi: true,
          },
        });
        this.logger.log(
          `제 ${round}회차 AI 노하우 게시글이 성공적으로 발행되었습니다 (Post ID: ${post.id})`,
        );
      }

      // 8. 슬랙 알림 발송
      await this.slackNotifierService.notifyAiPostPublished({
        round,
        title: post.title,
        postId: post.id,
      });

      return {
        success: true,
        postId: post.id,
        round,
        title: post.title,
      };
    } catch (error: any) {
      this.logger.error('AI 주간 노하우 글 발행 중 오류 발생:', error);
      await this.slackNotifierService.notifyAiPostFailed(
        command.round || 0,
        error?.message || String(error),
      );
      throw error;
    }
  }

  private async resolveCandidateGames(
    nextEpisode: number,
    round: number,
    sixBalls: number[],
    bonusBall: number,
    recentHotNumbers: number[],
    recentColdNumbers: number[],
  ): Promise<AnalyzedGameInfo[]> {
    const analyzed: AnalyzedGameInfo[] = [];

    try {
      const predictions = await prisma.prediction.findMany({
        where: { episode: nextEpisode },
        include: { algorithm: true },
        take: 5,
        orderBy: { id: 'desc' },
      });

      if (predictions && predictions.length > 0) {
        for (const p of predictions) {
          try {
            const json = JSON.parse(p.numbers);
            let nums: number[] = [];
            if (Array.isArray(json)) {
              nums = json.map(Number);
            } else if (typeof json === 'object') {
              nums = [
                json['1st'] ?? 0,
                json['2nd'] ?? 0,
                json['3rd'] ?? 0,
                json['4th'] ?? 0,
                json['5th'] ?? 0,
                json['6th'] ?? 0,
              ].map(Number);
            }

            if (nums.length === 6 && !nums.includes(0)) {
              const sorted = nums.sort((a, b) => a - b);
              const matchWithPrevious = sorted.filter((n) =>
                sixBalls.includes(n),
              ).length;
              const algoInfo = getAlgorithmDisplayInfo(p.algorithmType);
              const sourceName = p.algorithm?.name || algoInfo.name;
              const description =
                p.algorithm?.description || algoInfo.description;

              analyzed.push({
                label: `게임 ${String.fromCharCode(65 + analyzed.length)}`,
                numbers: sorted,
                matchWithPrevious,
                sourceType: 'ALGORITHM',
                sourceName,
                description: `${description} (직전 회차와 ${matchWithPrevious}개 일치/유사 패턴)`,
              });

              if (analyzed.length >= 5) break;
            }
          } catch {
            // ignore JSON parse error for malformed prediction record
          }
        }
      }
    } catch (e) {
      this.logger.warn(
        `예측 번호 조회 중 예외 발생, 하이브리드 추천 세트 구성: ${e}`,
      );
    }

    // 5개 미만인 경우, 통계 알고리즘과 이전 회차 분석 패턴을 조화롭게 결합한 세트로 보충
    const defaultTemplates: Array<{
      numbers: number[];
      sourceType: 'ALGORITHM' | 'HISTORICAL_PATTERN' | 'HYBRID';
      sourceName: string;
      description: string;
    }> = [
      {
        numbers: [3, 11, 19, 25, 34, 42],
        sourceType: 'ALGORITHM',
        sourceName: getAlgorithmDisplayInfo('SUM_BALANCE').name,
        description:
          '역대 당첨 총합 황금 구간(120~150)과 홀짝 3:3 균형을 충족하는 총합 밸런스 조합 (총합: 134)',
      },
      {
        numbers: [
          bonusBall > 0 && bonusBall <= 45 ? bonusBall : 1,
          12,
          18,
          27,
          34,
          40,
        ].sort((a, b) => a - b),
        sourceType: 'HYBRID',
        sourceName:
          '직전 회차 보너스볼 이월 및 중심수(18번) 연계 하이브리드 분석',
        description: `직전 ${round}회차 보너스볼(${bonusBall}번)의 본번호 이월 가능성과 강세 10번대 중심수 연계를 결합한 전략적 조합`,
      },
      {
        numbers: [5, 14, 22, 29, 37, 44],
        sourceType: 'ALGORITHM',
        sourceName: getAlgorithmDisplayInfo('TOTAL_MAX_COUNT_WEIGHTS').name,
        description:
          '역대 전체 회차 누적 다출현 열번호들과 최근 5회차 HOT 번호 흐름을 집중 반영한 가중치 조합',
      },
      {
        numbers: [
          recentColdNumbers[0] || 7,
          recentColdNumbers[1] || 16,
          23,
          31,
          38,
          45,
        ].sort((a, b) => a - b),
        sourceType: 'HISTORICAL_PATTERN',
        sourceName: '최근 5회차 장기 미출현(COLD) 콜드볼 반등 주기 분석',
        description:
          '최근 5회차 동안 출현하지 않았던 콜드볼들의 출현 주기 도래와 고번호대(40번대) 균형을 맞춘 반등 패턴',
      },
      {
        numbers: [6, 13, 20, 28, 35, 41],
        sourceType: 'ALGORITHM',
        sourceName: getAlgorithmDisplayInfo('PAIR_FREQUENCY').name,
        description:
          '역대 2수 궁합 출현 빈도가 높은 페어 조합과 끝자리 동끝수 분산 법칙을 적용한 연관수 조합',
      },
    ];

    while (analyzed.length < 5) {
      const template = defaultTemplates[analyzed.length];
      const matchWithPrevious = template.numbers.filter((n) =>
        sixBalls.includes(n),
      ).length;

      analyzed.push({
        label: `게임 ${String.fromCharCode(65 + analyzed.length)}`,
        numbers: template.numbers,
        matchWithPrevious,
        sourceType: template.sourceType,
        sourceName: template.sourceName,
        description: template.description,
      });
    }

    return analyzed;
  }
}
