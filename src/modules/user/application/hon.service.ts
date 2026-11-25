import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { IHonRepository, HON_REPOSITORY_TOKEN } from '../domain/ports/hon.port';
import {
  IPaymentRepository,
  PAYMENT_REPOSITORY_TOKEN,
} from '../domain/ports/payment.port';
import { createHmac, randomUUID } from 'crypto';
import { prisma } from '../../../libs/prisma';

export type MinigameType = 'QUIZ' | 'MEMORY' | 'DETECTIVE' | 'CATCHER';

export const MINIGAME_LABELS: Record<MinigameType, string> = {
  QUIZ: '로또 지식 퀴즈',
  MEMORY: '로또볼 메모리 매치',
  DETECTIVE: '행운의 번호 추리',
  CATCHER: '스피드 로또 캐처',
};

@Injectable()
export class HonService {
  constructor(
    @Inject(HON_REPOSITORY_TOKEN)
    private readonly honRepository: IHonRepository,
    @Inject(PAYMENT_REPOSITORY_TOKEN)
    private readonly paymentRepository: IPaymentRepository,
  ) {}

  /**
   * 1. 단건 결제 성공에 따른 혼(Hon) 크레딧 지급 및 이벤트 발행
   */
  async chargeHon(
    paymentId: string,
    userId: string,
    honAmount: number,
    isFree: boolean = false,
    description?: string,
  ): Promise<void> {
    const currentEvents = await this.paymentRepository.getEvents(paymentId);
    const nextVersion = currentEvents.length + 1;

    await this.paymentRepository.saveEvent({
      paymentId,
      version: nextVersion,
      eventType: 'HonCharged',
      payload: { userId, chargedHon: honAmount },
    });

    const currentHon = await this.honRepository.getHon(userId);
    const currentFree = currentHon ? currentHon.freeBalance : 0;
    const currentPaid = currentHon ? currentHon.paidBalance : 0;
    const newPaid = currentPaid + (isFree ? 0 : honAmount);
    const newFree = currentFree + (isFree ? honAmount : 0);
    const totalBalance = newFree + newPaid;

    await this.honRepository.saveHon({
      userId,
      freeBalance: newFree,
      paidBalance: newPaid,
    });

    await this.honRepository.saveHonEvent({
      userId,
      type: 'CHARGE',
      amount: honAmount,
      freeAmount: isFree ? honAmount : 0,
      paidAmount: isFree ? 0 : honAmount,
      balance: totalBalance,
      description: description || '결제 충전',
    });
  }

  /**
   * 2. 정기 구독 최초 가입(빌링키 발급)에 따른 혜택 시작 및 이벤트 발행
   */
  async startSubscription(
    paymentId: string,
    userId: string,
    plan: string,
    billingKey: string,
  ): Promise<void> {
    const currentEvents = await this.paymentRepository.getEvents(paymentId);
    const nextVersion = currentEvents.length + 1;

    const now = new Date();
    let startsAt = now;
    let endsAt = new Date();
    if (plan === 'MONTHLY') {
      endsAt.setMonth(now.getMonth() + 1);
    } else {
      endsAt.setFullYear(now.getFullYear() + 1);
    }

    // Check for existing active/cancelled subscription to extend the period if upgrading MONTHLY -> YEARLY
    const existing = await this.honRepository.getSubscription(userId);
    if (existing && existing.endsAt > now) {
      if (existing.plan === 'MONTHLY' && plan === 'YEARLY') {
        startsAt = existing.startsAt;
        endsAt = new Date(existing.endsAt);
        endsAt.setFullYear(endsAt.getFullYear() + 1);
      }
    }

    await this.paymentRepository.saveEvent({
      paymentId,
      version: nextVersion,
      eventType: 'SubscriptionStarted',
      payload: { userId, plan, billingKey, nextPaymentAt: endsAt },
    });

    await this.honRepository.saveSubscription({
      userId,
      plan,
      status: 'ACTIVE',
      billingKey,
      nextPaymentAt: endsAt,
      startsAt,
      endsAt,
    });
  }

  /**
   * 3. 방문자 혼 정보 조회
   */
  async getHon(userId: string) {
    return this.honRepository.getHon(userId);
  }

  /**
   * 4. 방문자 정기 구독 조회
   */
  async getSubscription(userId: string) {
    return this.honRepository.getSubscription(userId);
  }

  /**
   * 정기 구독 취소 (해지 예약)
   */
  async cancelSubscription(userId: string): Promise<void> {
    const subscription = await this.honRepository.getSubscription(userId);
    if (!subscription || subscription.status !== 'ACTIVE') {
      throw new BadRequestException(
        '해지 가능한 활성 구독이 존재하지 않습니다.',
      );
    }

    // 상태를 CANCELLED로 변경 (만료일까지 권한은 유지되나 자동 결제는 정지됨)
    await this.honRepository.saveSubscription({
      ...subscription,
      status: 'CANCELLED',
      updatedAt: new Date(),
    });

    // 구독 해지 이벤트 발행
    await this.paymentRepository.saveEvent({
      paymentId: randomUUID(),
      version: 1,
      eventType: 'SubscriptionCancelled',
      payload: { userId },
    });
  }

  /**
   * 5. 방문자 혼 차감 (구독자인 경우 면제)
   */
  async deductHon(
    userId: string,
    amount: number,
    description?: string,
    deductPaidFirst: boolean = false,
  ): Promise<void> {
    if (!deductPaidFirst) {
      const subscription = await this.honRepository.getSubscription(userId);
      if (
        subscription &&
        (subscription.status === 'ACTIVE' ||
          (subscription.status === 'CANCELLED' &&
            subscription.endsAt &&
            new Date(subscription.endsAt) > new Date()))
      ) {
        return; // 유효한 구독자는 무제한
      }
    }

    const hon = await this.honRepository.getHon(userId);
    const free = hon ? hon.freeBalance : 0;
    const paid = hon ? hon.paidBalance : 0;
    const totalBalance = free + paid;

    if (totalBalance < amount) {
      throw new BadRequestException(
        `HON이 부족합니다. 충전 후 이용해 주세요. (필요: ${amount} HON, 보유: ${totalBalance} HON)`,
      );
    }

    let remainingDeduct = amount;
    let newFree = free;
    let newPaid = paid;

    if (deductPaidFirst) {
      // 유료(충전) HON 우선 차감
      if (newPaid >= remainingDeduct) {
        newPaid -= remainingDeduct;
        remainingDeduct = 0;
      } else {
        remainingDeduct -= newPaid;
        newPaid = 0;
      }

      // 부족분은 무료(이벤트) HON에서 차감
      if (remainingDeduct > 0) {
        newFree -= remainingDeduct;
      }
    } else {
      // 무료(이벤트) HON 우선 차감
      if (newFree >= remainingDeduct) {
        newFree -= remainingDeduct;
        remainingDeduct = 0;
      } else {
        remainingDeduct -= newFree;
        newFree = 0;
      }

      // 부족분은 유료 HON에서 차감
      if (remainingDeduct > 0) {
        newPaid -= remainingDeduct;
      }
    }

    const newTotalBalance = newFree + newPaid;

    await this.honRepository.saveHon({
      userId,
      freeBalance: newFree,
      paidBalance: newPaid,
    });

    await this.honRepository.saveHonEvent({
      userId,
      type: 'DEDUCT',
      amount: -amount,
      freeAmount: -(free - newFree),
      paidAmount: -(paid - newPaid),
      balance: newTotalBalance,
      description: description || '혼 차감',
    });
  }

  /**
   * 6. 관리자 수동 혼(Hon) 지급/차감
   */
  async provisionHonByAdmin(userId: string, amount: number): Promise<void> {
    const paymentId = `admin-provision-${randomUUID()}`;
    await this.paymentRepository.saveEvent({
      paymentId,
      version: 1,
      eventType: 'AdminHonProvisioned',
      payload: { userId, amount },
    });

    const currentHon = await this.honRepository.getHon(userId);
    const free = currentHon ? currentHon.freeBalance : 0;
    const paid = currentHon ? currentHon.paidBalance : 0;

    let newFree = free;
    let newPaid = paid;

    if (amount >= 0) {
      // 관리자 지급은 freeBalance에 반영
      newFree = free + amount;
    } else {
      // 관리자 차감은 우선 paidBalance에 반영하고 부족분은 freeBalance에서 차감하되 음수가 되지 않도록 설정
      newPaid = Math.max(0, paid + amount);
      const remainingDeduct = paid + amount;
      if (remainingDeduct < 0) {
        newFree = Math.max(0, free + remainingDeduct);
      }
    }
    const newTotalBalance = newFree + newPaid;

    await this.honRepository.saveHon({
      userId,
      freeBalance: newFree,
      paidBalance: newPaid,
    });

    await this.honRepository.saveHonEvent({
      userId,
      type: amount >= 0 ? 'ADMIN_PROVISION' : 'ADMIN_DEDUCT',
      amount,
      freeAmount: newFree - free,
      paidAmount: newPaid - paid,
      balance: newTotalBalance,
      description: amount >= 0 ? '관리자 지급' : '관리자 차감',
    });
  }

  async getHonEvents(userId: string) {
    return this.honRepository.getHonEvents(userId);
  }

  async provisionUnlimitedSubscriptionByAdmin(
    userId: string,
    endsAt: Date,
  ): Promise<void> {
    const paymentId = `admin-unlimited-${randomUUID()}`;
    const now = new Date();

    await this.paymentRepository.saveEvent({
      paymentId,
      version: 1,
      eventType: 'AdminUnlimitedSubscriptionProvisioned',
      payload: { userId, startsAt: now, endsAt },
    });

    await this.honRepository.saveSubscription({
      userId,
      plan: 'UNLIMITED',
      status: 'ACTIVE',
      billingKey: 'ADMIN_FREE_PASS',
      nextPaymentAt: endsAt,
      startsAt: now,
      endsAt,
    });
  }

  async bulkProvisionHonByAdmin(amount: number): Promise<void> {
    const users = await prisma.user.findMany({
      select: { id: true },
    });

    // Process sequentially to avoid database lock and guarantee correct event ordering
    for (const v of users) {
      try {
        await this.provisionHonByAdmin(v.id, amount);
      } catch (error) {
        // Log individual error but continue processing other users
        console.error(`Failed to provision Hon for user ${v.id}:`, error);
      }
    }
  }

  /**
   * 7. 미니게임 KST 당일 자정~23:59:59 범위 계산
   */
  private getKstTodayRange(now: Date = new Date()): {
    startOfKstDay: Date;
    endOfKstDay: Date;
    kstDateString: string;
  } {
    const kstOffsetMs = 9 * 60 * 60 * 1000;
    const kstTime = new Date(now.getTime() + kstOffsetMs);
    const yyyy = kstTime.getUTCFullYear();
    const mm = String(kstTime.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kstTime.getUTCDate()).padStart(2, '0');
    const kstDateString = `${yyyy}-${mm}-${dd}`;

    const startOfKstDay = new Date(`${kstDateString}T00:00:00.000+09:00`);
    const endOfKstDay = new Date(`${kstDateString}T23:59:59.999+09:00`);

    return { startOfKstDay, endOfKstDay, kstDateString };
  }

  /**
   * 8. 미니게임 시작 티켓 발급 (Stateless HMAC-SHA256)
   */
  issueMinigameTicket(
    gameType: string,
    issuedAtMs: number = Date.now(),
  ): string {
    const normalizedType = (gameType || 'QUIZ').toUpperCase();
    if (!Object.keys(MINIGAME_LABELS).includes(normalizedType)) {
      throw new BadRequestException('유효하지 않은 미니게임 종류입니다.');
    }
    const nonce = randomUUID().slice(0, 8);
    const payload = `${normalizedType}.${issuedAtMs}.${nonce}`;
    const secret = process.env.JWT_SECRET || 'hactto-minigame-hmac-secret-2026';
    const signature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
      .slice(0, 24);
    return `${payload}.${signature}`;
  }

  /**
   * 9. 미니게임 티켓 서명 및 최소 플레이 소요 시간(minDurationMs) 검증
   */
  verifyMinigameTicket(
    ticket: string,
    expectedGameType: string,
    minDurationMs: number = 4000,
  ): boolean {
    if (!ticket || typeof ticket !== 'string') return false;
    const parts = ticket.split('.');
    if (parts.length !== 4) return false;

    const [gameType, issuedAtStr, nonce, signature] = parts;
    if (gameType !== expectedGameType.toUpperCase()) return false;

    const issuedAtMs = Number(issuedAtStr);
    if (!Number.isFinite(issuedAtMs)) return false;

    const payload = `${gameType}.${issuedAtStr}.${nonce}`;
    const secret = process.env.JWT_SECRET || 'hactto-minigame-hmac-secret-2026';
    const expectedSig = createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
      .slice(0, 24);

    if (signature !== expectedSig) return false;

    const elapsed = Date.now() - issuedAtMs;
    const maxAgeMs = 2 * 60 * 60 * 1000; // 2 hours
    if (elapsed < minDurationMs || elapsed > maxAgeMs) {
      return false;
    }

    return true;
  }

  /**
   * 10. 당일 KST 기준 미니게임 10 HON 및 4종 올클리어(+30 HON) 보상 수령 상태 조회
   */
  async getMinigameStatus(userId: string) {
    const { startOfKstDay, endOfKstDay, kstDateString } =
      this.getKstTodayRange();
    const events = await this.honRepository.getHonEvents(userId);
    const todayEvents = (events || []).filter((ev) => {
      if (!ev.createdAt) return false;
      const created = new Date(ev.createdAt);
      return created >= startOfKstDay && created <= endOfKstDay;
    });

    const todayRewardEvent = todayEvents.find(
      (ev) => ev.type === 'MINIGAME_REWARD',
    );
    const todayAllClearEvent = todayEvents.find(
      (ev) => ev.type === 'MINIGAME_ALL_CLEAR_REWARD',
    );

    const clearedSet = new Set<MinigameType>();
    for (const ev of todayEvents) {
      if (
        ev.type === 'MINIGAME_REWARD' ||
        ev.type === 'MINIGAME_ALL_CLEAR_REWARD' ||
        ev.type === 'MINIGAME_CLEAR_LOG'
      ) {
        (Object.keys(MINIGAME_LABELS) as MinigameType[]).forEach((gt) => {
          if (
            ev.description?.includes(MINIGAME_LABELS[gt]) ||
            ev.description?.includes(gt)
          ) {
            clearedSet.add(gt);
          }
        });
      }
    }

    if (todayAllClearEvent) {
      (Object.keys(MINIGAME_LABELS) as MinigameType[]).forEach((gt) =>
        clearedSet.add(gt),
      );
    }

    return {
      kstDate: kstDateString,
      rewardClaimedToday: !!todayRewardEvent,
      allClearClaimedToday: !!todayAllClearEvent,
      clearedGamesToday: Array.from(clearedSet),
      claimedAt: todayRewardEvent?.createdAt ?? null,
      allClearClaimedAt: todayAllClearEvent?.createdAt ?? null,
      description:
        todayAllClearEvent?.description ??
        todayRewardEvent?.description ??
        null,
      dailyRewardAmount: 10,
      allClearRewardAmount: 30,
    };
  }

  /**
   * 11. 미니게임 클리어에 따른 일일 10 HON 지급 + 4종 모두 달성 시 +30 HON 추가 지급 (KST 당일 1회 멱등 보장)
   */
  async claimMinigameReward(
    userId: string,
    gameType: MinigameType,
    ticket?: string,
    clearedGamesFromClient?: MinigameType[],
  ) {
    const normalizedType = (gameType || 'QUIZ').toUpperCase() as MinigameType;
    if (!MINIGAME_LABELS[normalizedType]) {
      throw new BadRequestException('유효하지 않은 미니게임 종류입니다.');
    }

    if (ticket && !this.verifyMinigameTicket(ticket, normalizedType, 4000)) {
      throw new BadRequestException(
        '비정상적인 게임 완료 요청입니다. 다시 시도해 주세요.',
      );
    }

    const status = await this.getMinigameStatus(userId);
    const currentHon = await this.honRepository.getHon(userId);
    let currentFree = currentHon ? currentHon.freeBalance : 0;
    const currentPaid = currentHon ? currentHon.paidBalance : 0;

    const mergedCleared = new Set<MinigameType>(status.clearedGamesToday);
    mergedCleared.add(normalizedType);
    if (Array.isArray(clearedGamesFromClient)) {
      for (const cg of clearedGamesFromClient) {
        const up = String(cg).toUpperCase() as MinigameType;
        if (MINIGAME_LABELS[up]) {
          mergedCleared.add(up);
        }
      }
    }

    let rewardedHon = 0;
    let baseRewardGrantedNow = false;
    let allClearRewardGrantedNow = false;

    // 1) 당일 첫 미션 성공 보상 (+10 HON)
    if (!status.rewardClaimedToday) {
      const baseAmount = 10;
      currentFree += baseAmount;
      rewardedHon += baseAmount;
      baseRewardGrantedNow = true;

      await this.honRepository.saveHon({
        userId,
        freeBalance: currentFree,
        paidBalance: currentPaid,
      });

      await this.honRepository.saveHonEvent({
        userId,
        type: 'MINIGAME_REWARD',
        amount: baseAmount,
        freeAmount: baseAmount,
        paidAmount: 0,
        balance: currentFree + currentPaid,
        description: `일일 미니게임 미션 달성 (${MINIGAME_LABELS[normalizedType]})`,
      });
    } else if (!status.clearedGamesToday.includes(normalizedType)) {
      // 이미 10 HON을 받은 후 다른 종류의 게임을 새로 클리어했을 때 0 HON 로그를 남겨 서버에서도 4종 달성 추적
      await this.honRepository.saveHonEvent({
        userId,
        type: 'MINIGAME_CLEAR_LOG',
        amount: 0,
        freeAmount: 0,
        paidAmount: 0,
        balance: currentFree + currentPaid,
        description: `일일 미니게임 추가 클리어 (${MINIGAME_LABELS[normalizedType]})`,
      });
    }

    // 2) 4종 미션 모두 달성 시 추가 보너스 (+30 HON)
    const isAllFourCleared =
      mergedCleared.size >= 4 &&
      (Object.keys(MINIGAME_LABELS) as MinigameType[]).every((gt) =>
        mergedCleared.has(gt),
      );

    if (isAllFourCleared && !status.allClearClaimedToday) {
      const bonusAmount = 30;
      currentFree += bonusAmount;
      rewardedHon += bonusAmount;
      allClearRewardGrantedNow = true;

      await this.honRepository.saveHon({
        userId,
        freeBalance: currentFree,
        paidBalance: currentPaid,
      });

      await this.honRepository.saveHonEvent({
        userId,
        type: 'MINIGAME_ALL_CLEAR_REWARD',
        amount: bonusAmount,
        freeAmount: bonusAmount,
        paidAmount: 0,
        balance: currentFree + currentPaid,
        description:
          '일일 미니게임 4종 올클리어 추가 보너스 (로또 지식 퀴즈 · 로또볼 메모리 매치 · 행운의 번호 추리 · 스피드 로또 캐처)',
      });
    }

    return {
      alreadyClaimed: !baseRewardGrantedNow && !allClearRewardGrantedNow,
      rewardedHon,
      baseRewardGrantedNow,
      allClearRewardGrantedNow,
      allClearClaimedToday:
        status.allClearClaimedToday || allClearRewardGrantedNow,
      clearedGamesToday: Array.from(mergedCleared),
      freeBalance: currentFree,
      paidBalance: currentPaid,
      totalBalance: currentFree + currentPaid,
      gameType: normalizedType,
    };
  }
}
