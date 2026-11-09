import { LottoNumber } from '../vos/lotto-number.vo';
import { BallTemperature } from '../vos/ball.temperature.vo';

export class LotteryBallStatus {
  public readonly ball: number; // 공 번호 (1~45)
  public readonly totalEpisodes: number; // 전체 추첨 회차 수
  public readonly totalCount: number; // 본번호(1~6번째 자리) 총 등장 횟수
  public readonly bonusCount: number; // 보너스 번호 등장 횟수
  public readonly appearanceRate: number; // 등장 확률 (totalCount / totalEpisodes * 100)
  public readonly rank: number; // 전체 45개 번호 중 출현 순위 (1~45)
  public readonly positionCounts: number[]; // [1번째~6번째 자리별 등장 횟수]
  public readonly recentTen: number; // 최근 10회 등장 횟수
  public readonly recentThirty: number; // 최근 30회 등장 횟수
  public readonly status: BallTemperature; // 열번호 | 온번호 | 냉번호
  public readonly skip: number; // 미출현 간격
  public readonly friendlyNumbers: LottoNumber[]; // 동반수
  public readonly friendlyCounts: number[]; // 동반 출현 횟수 (friendlyNumbers와 1:1 매칭)
  public readonly latestEpisode: number; // 최근 등장 회차

  constructor(
    recentTen: number,
    recentThirty: number,
    status: BallTemperature,
    skip: number,
    friendlyNumbers: number[],
    latestEpisode: number,
    ball = 0,
    totalEpisodes = 0,
    totalCount = 0,
    bonusCount = 0,
    appearanceRate = 0,
    rank = 0,
    positionCounts: number[] = [0, 0, 0, 0, 0, 0],
    friendlyCounts: number[] = [],
  ) {
    this.ball = ball;
    this.totalEpisodes = totalEpisodes;
    this.totalCount = totalCount;
    this.bonusCount = bonusCount;
    this.appearanceRate = appearanceRate;
    this.rank = rank;
    this.positionCounts = positionCounts;
    this.recentTen = recentTen;
    this.recentThirty = recentThirty;
    this.status = status;
    this.skip = skip;
    this.friendlyNumbers = friendlyNumbers.map(
      (number) => new LottoNumber(number),
    );
    this.friendlyCounts = friendlyCounts;
    this.latestEpisode = latestEpisode;
  }

  getFriendlyNumberArray(): number[] {
    return this.friendlyNumbers.map((number) => number.value);
  }
}
