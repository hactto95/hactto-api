import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetAllLotteryBallStatusesQuery } from '../queries/get-all-lottery-ball-statuses.query';
import { RedisService } from '../../../../helpers/redis/application/redis.service';
import { LotteryBallStatus } from '../../domain/aggregates/lottery-ball-status.entity';
import {
  getBallTemperature,
  BallTemperature,
} from '../../domain/vos/ball.temperature.vo';
import { prisma } from '../../../../libs/prisma';

@QueryHandler(GetAllLotteryBallStatusesQuery)
export class GetAllLotteryBallStatusesHandler implements IQueryHandler<GetAllLotteryBallStatusesQuery> {
  private cachedRawNumbers: any[] | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_TTL_MS = 60000; // 1 minute

  constructor(private readonly redisService: RedisService) {}

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

  async execute(): Promise<LotteryBallStatus[]> {
    const cacheKey = 'lottery-ball:statuses:all:v2';

    const cachedData = await this.redisService.get(cacheKey);
    if (cachedData) {
      const parsedList = JSON.parse(cachedData) as any[];
      return parsedList.map(
        (parsed) =>
          new LotteryBallStatus(
            parsed.recentTen,
            parsed.recentThirty,
            parsed.status,
            parsed.skip,
            parsed.friendlyNumbers,
            parsed.latestEpisode,
            parsed.ball,
            parsed.totalEpisodes,
            parsed.totalCount,
            parsed.bonusCount,
            parsed.appearanceRate,
            parsed.rank,
            parsed.positionCounts,
            parsed.friendlyCounts ?? [],
          ),
      );
    }

    const rawList = await this.getRawWinningNumbers();
    const totalEpisodes = rawList.length;

    if (totalEpisodes === 0) {
      return Array.from({ length: 45 }, (_, idx) => {
        const ball = idx + 1;
        return new LotteryBallStatus(
          0,
          0,
          BallTemperature.COLD,
          0,
          [],
          0,
          ball,
          0,
          0,
          0,
          0,
          1,
          [0, 0, 0, 0, 0, 0],
        );
      });
    }

    const totalCounts = new Array(46).fill(0);
    const bonusCounts = new Array(46).fill(0);
    const recentTenCounts = new Array(46).fill(0);
    const recentThirtyCounts = new Array(46).fill(0);
    const latestEpisodes = new Array(46).fill(0);
    const positionCountsMap: number[][] = Array.from({ length: 46 }, () => [
      0, 0, 0, 0, 0, 0,
    ]);
    const coOccurrenceMaps: Map<number, number>[] = Array.from(
      { length: 46 },
      () => new Map<number, number>(),
    );

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
        const ball = numbers[pos];
        if (ball < 1 || ball > 45) continue;

        positionCountsMap[ball][pos]++;
        totalCounts[ball]++;

        if (latestEpisodes[ball] === 0) {
          latestEpisodes[ball] = currentWinning.episode;
        }
        if (i < 10) {
          recentTenCounts[ball]++;
          recentThirtyCounts[ball]++;
        } else if (i < 30) {
          recentThirtyCounts[ball]++;
        }

        const coMap = coOccurrenceMaps[ball];
        for (let j = 0; j < 6; j++) {
          const other = numbers[j];
          if (other !== ball && other >= 1 && other <= 45) {
            coMap.set(other, (coMap.get(other) || 0) + 1);
          }
        }
      }

      const bonusBall = currentWinning.ltBnsWnNo;
      if (bonusBall >= 1 && bonusBall <= 45) {
        bonusCounts[bonusBall]++;
      }
    }

    const maxEpisode = rawList[0].episode;
    const results: LotteryBallStatus[] = [];

    for (let ball = 1; ball <= 45; ball++) {
      const totalCount = totalCounts[ball];
      let rank = 1;
      for (let other = 1; other <= 45; other++) {
        if (totalCounts[other] > totalCount) {
          rank++;
        }
      }

      const appearanceRate = Number(
        ((totalCount / totalEpisodes) * 100).toFixed(2),
      );
      const latestEp = latestEpisodes[ball];
      const skip = latestEp > 0 ? maxEpisode - latestEp : totalEpisodes;
      const topFriendlyEntries = Array.from(coOccurrenceMaps[ball].entries())
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, 3);
      const friendlyNumbers = topFriendlyEntries.map(([num]) => num);
      const friendlyCounts = topFriendlyEntries.map(([, cnt]) => cnt);

      results.push(
        new LotteryBallStatus(
          recentTenCounts[ball],
          recentThirtyCounts[ball],
          getBallTemperature(skip),
          skip,
          friendlyNumbers,
          latestEp,
          ball,
          totalEpisodes,
          totalCount,
          bonusCounts[ball],
          appearanceRate,
          rank,
          positionCountsMap[ball],
          friendlyCounts,
        ),
      );
    }

    await this.redisService.set(
      cacheKey,
      JSON.stringify(
        results.map((r) => ({
          ball: r.ball,
          totalEpisodes: r.totalEpisodes,
          totalCount: r.totalCount,
          bonusCount: r.bonusCount,
          appearanceRate: r.appearanceRate,
          rank: r.rank,
          positionCounts: r.positionCounts,
          recentTen: r.recentTen,
          recentThirty: r.recentThirty,
          status: r.status,
          skip: r.skip,
          friendlyNumbers: r.getFriendlyNumberArray(),
          friendlyCounts: r.friendlyCounts,
          latestEpisode: r.latestEpisode,
        })),
      ),
      604800, // 7 days
    );

    return results;
  }
}
