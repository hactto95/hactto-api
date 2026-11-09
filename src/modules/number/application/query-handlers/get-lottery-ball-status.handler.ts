import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetLotteryBallStatusQuery } from '../queries/get-lottery-ball-status.query';
import {
  IWinningNumberRepository,
  WINNING_NUMBER_REPOSITORY_TOKEN,
} from '../../domain/ports/winning-number.port';
import { Inject } from '@nestjs/common';
import { RedisService } from '../../../../helpers/redis/application/redis.service';
import { LotteryBallStatus } from '../../domain/aggregates/lottery-ball-status.entity';
import {
  getBallTemperature,
  BallTemperature,
} from '../../domain/vos/ball.temperature.vo';
import { prisma } from '../../../../libs/prisma';

@QueryHandler(GetLotteryBallStatusQuery)
export class GetLotteryBallStatusHandler implements IQueryHandler<GetLotteryBallStatusQuery> {
  private cachedRawNumbers: any[] | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_TTL_MS = 60000; // 1 minute

  constructor(
    @Inject(WINNING_NUMBER_REPOSITORY_TOKEN)
    private readonly repository: IWinningNumberRepository,
    private readonly redisService: RedisService,
  ) {}

  private async getRawWinningNumbers(): Promise<any[]> {
    const now = Date.now();
    if (
      this.cachedRawNumbers &&
      now - this.cacheTimestamp < this.CACHE_TTL_MS
    ) {
      return this.cachedRawNumbers;
    }

    const raw = await prisma.winningNumber.findMany({
      where: { isDrawn: true },
      select: {
        episode: true,
        lt1WnNo: true,
        lt2WnNo: true,
        lt3WnNo: true,
        lt4WnNo: true,
        lt5WnNo: true,
        lt6WnNo: true,
        ltBnsWnNo: true,
      },
      orderBy: {
        episode: 'desc',
      },
    });

    this.cachedRawNumbers = raw;
    this.cacheTimestamp = now;
    return raw;
  }

  async execute(query: GetLotteryBallStatusQuery): Promise<LotteryBallStatus> {
    const cacheKey = `lottery-ball:status:v3:${query.ball}:${query.beforeEpisode ?? 'latest'}`;

    const cachedData = await this.redisService.get(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      return new LotteryBallStatus(
        parsed.recentTen,
        parsed.recentThirty,
        parsed.status,
        parsed.skip,
        parsed.friendlyNumbers,
        parsed.latestEpisode,
        parsed.ball ?? query.ball,
        parsed.totalEpisodes ?? 0,
        parsed.totalCount ?? 0,
        parsed.bonusCount ?? 0,
        parsed.appearanceRate ?? 0,
        parsed.rank ?? 0,
        parsed.positionCounts ?? [0, 0, 0, 0, 0, 0],
        parsed.friendlyCounts ?? [],
      );
    }

    let rawList = await this.getRawWinningNumbers();
    if (query.beforeEpisode !== undefined) {
      rawList = rawList.filter((wn) => wn.episode < query.beforeEpisode!);
    }

    if (rawList.length === 0) {
      return new LotteryBallStatus(
        0,
        0,
        BallTemperature.COLD,
        0,
        [],
        0,
        query.ball,
        0,
        0,
        0,
        0,
        1,
        [0, 0, 0, 0, 0, 0],
      );
    }

    const totalEpisodes = rawList.length;
    let recentTen = 0;
    let recentThirty = 0;
    let latestEpisode = 0;
    let totalCount = 0;
    let bonusCount = 0;
    const positionCounts = [0, 0, 0, 0, 0, 0];
    const allBallTotalCounts = new Array(46).fill(0);

    const coOccurrenceMap = new Map<number, number>();

    for (let i = 0; i < rawList.length; i++) {
      const currentWinning = rawList[i];
      const numbers = [
        currentWinning.lt1WnNo,
        currentWinning.lt2WnNo,
        currentWinning.lt3WnNo,
        currentWinning.lt4WnNo,
        currentWinning.lt5WnNo,
        currentWinning.lt6WnNo,
      ];

      for (let pos = 0; pos < 6; pos++) {
        const n = numbers[pos];
        if (n >= 1 && n <= 45) {
          allBallTotalCounts[n]++;
        }
        if (n === query.ball) {
          positionCounts[pos]++;
          totalCount++;
        }
      }

      if (currentWinning.ltBnsWnNo === query.ball) {
        bonusCount++;
      }

      const hasBall = numbers.includes(query.ball);

      if (hasBall) {
        if (latestEpisode === 0) latestEpisode = currentWinning.episode;
        if (i < 10) {
          recentTen++;
          recentThirty++;
        } else if (i < 30) recentThirty++;

        numbers.forEach((num) => {
          if (num !== query.ball) {
            coOccurrenceMap.set(num, (coOccurrenceMap.get(num) || 0) + 1);
          }
        });
      }
    }

    let rank = 1;
    for (let b = 1; b <= 45; b++) {
      if (allBallTotalCounts[b] > totalCount) {
        rank++;
      }
    }

    const appearanceRate =
      totalEpisodes > 0
        ? Number(((totalCount / totalEpisodes) * 100).toFixed(2))
        : 0;

    const topFriendlyEntries = Array.from(coOccurrenceMap.entries())
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 3);
    const friendlyNumbers = topFriendlyEntries.map(([num]) => num);
    const friendlyCounts = topFriendlyEntries.map(([, cnt]) => cnt);

    const skip =
      latestEpisode > 0 ? rawList[0].episode - latestEpisode : totalEpisodes;

    const result = new LotteryBallStatus(
      recentTen,
      recentThirty,
      getBallTemperature(skip),
      skip,
      friendlyNumbers,
      latestEpisode,
      query.ball,
      totalEpisodes,
      totalCount,
      bonusCount,
      appearanceRate,
      rank,
      positionCounts,
      friendlyCounts,
    );

    await this.redisService.set(
      cacheKey,
      JSON.stringify({
        ball: result.ball,
        totalEpisodes: result.totalEpisodes,
        totalCount: result.totalCount,
        bonusCount: result.bonusCount,
        appearanceRate: result.appearanceRate,
        rank: result.rank,
        positionCounts: result.positionCounts,
        recentTen: result.recentTen,
        recentThirty: result.recentThirty,
        status: result.status,
        skip: skip,
        friendlyNumbers: result.getFriendlyNumberArray(),
        friendlyCounts: result.friendlyCounts,
        latestEpisode: result.latestEpisode,
      }),
      604800, // 7 days
    );

    return result;
  }
}
