import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PublishAiWeeklyBriefingCommand } from '../commands/publish-ai-weekly-briefing.command';
import { GeminiService } from '../../../../common/services/gemini.service';
import { SlackNotifierService } from '../../../../common/services/slack-notifier.service';
import { prisma } from '../../../../libs/prisma';
import { BoardCategory } from '../../../../generated/prisma/client';
import {
  AI_ANALYST_USER_ID,
  ensureAiAnalystUser,
} from '../../../user/infrastructure/seeds/ai-analyst.seed';
import { GetLatestWinningNumberQuery } from '../../../number/application/queries/get-latest-winning-number.query';
import { GetWinningNumberByEpisodeQuery } from '../../../number/application/queries/get-winning-number-by-episode.query';

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
      if (!command.force) {
        const existing = await prisma.post.findFirst({
          where: {
            lottoRound: round,
            category: BoardCategory.KNOWHOW,
            isAi: true,
            isDeleted: false,
          },
        });

        if (existing) {
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

      // 5. 다음 회차 분석 후보 5개 게임 수집
      const candidateGames = await this.resolveCandidateGames(round + 1);

      const analyzedGames = candidateGames.map((game, index) => {
        const matchWithPrevious = game.filter((n) =>
          sixBalls.includes(n),
        ).length;
        return {
          label: `게임 ${String.fromCharCode(65 + index)}`,
          numbers: game,
          matchWithPrevious,
        };
      });

      // 가장 직전 당첨번호와 유사도가 높은 게임을 원픽으로 선정
      const sortedBySimilarity = [...analyzedGames].sort(
        (a, b) => b.matchWithPrevious - a.matchWithPrevious,
      );
      const best = sortedBySimilarity[0];
      const bestPickGame = {
        label: best.label,
        numbers: best.numbers,
        reason:
          best.matchWithPrevious > 0
            ? `직전 ${round}회차 당첨번호와 ${best.matchWithPrevious}개 번호 일치 및 주요 번호대 흐름 부합`
            : `직전 ${round}회차 미출현 번호군을 보완하며 총합 밸런스(${best.numbers.reduce((a, b) => a + b, 0)})가 이상적인 조합`,
      };

      // 6. Gemini API 호출 (파워블로거 톤앤매너 프롬프트)
      const { title, content } = await this.geminiService.generateBriefing({
        round,
        winningNumbers: sixBalls,
        bonusNumber: bonusBall,
        oddEvenRatio,
        sumRange,
        analyzedGames,
        bestPickGame,
      });

      // 7. DB 게시글 저장
      const post = await prisma.post.create({
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
        `🎉 제 ${round}회차 AI 노하우 게시글이 성공적으로 발행되었습니다 (Post ID: ${post.id})`,
      );

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
  ): Promise<number[][]> {
    try {
      const predictions = await prisma.prediction.findMany({
        where: { episode: nextEpisode },
        take: 5,
        orderBy: { id: 'desc' },
      });

      if (predictions && predictions.length >= 5) {
        const parsed = predictions
          .map((p) => {
            try {
              const json = JSON.parse(p.numbers);
              if (Array.isArray(json)) return json.map(Number);
              return [
                json['1st'] ?? 0,
                json['2nd'] ?? 0,
                json['3rd'] ?? 0,
                json['4th'] ?? 0,
                json['5th'] ?? 0,
                json['6th'] ?? 0,
              ].map(Number);
            } catch {
              return [];
            }
          })
          .filter((arr) => arr.length === 6 && !arr.includes(0));

        if (parsed.length >= 5) {
          return parsed.slice(0, 5);
        }
      }
    } catch (e) {
      this.logger.warn(
        `예측 번호 조회 중 예외 발생, 기본 필터링 세트 사용: ${e}`,
      );
    }

    // 기본 필터링 추천 5게임
    return [
      [3, 11, 19, 25, 34, 42],
      [5, 14, 22, 29, 37, 44],
      [8, 16, 23, 31, 38, 45],
      [1, 13, 20, 27, 35, 41],
      [6, 17, 24, 30, 39, 43],
    ];
  }
}
