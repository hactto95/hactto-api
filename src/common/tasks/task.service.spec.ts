import { CommandBus } from '@nestjs/cqrs';
import { TaskService } from './task.service';
import { SystemStatusService } from '../utils/system-status/system-status.service';
import { IHonRepository } from '../../modules/user/domain/ports/hon.port';
import { IPaymentRepository } from '../../modules/user/domain/ports/payment.port';
import { PortoneClient } from '../../modules/user/infrastructure/clients/portone.client';
import { prisma } from '../../libs/prisma';

jest.mock('../../libs/prisma', () => ({
  prisma: {
    adminHonEventSetting: {
      findMany: jest.fn(),
    },
    hon: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    honEvent: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('TaskService', () => {
  let taskService: TaskService;
  let honRepository: jest.Mocked<IHonRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    honRepository = {
      getHon: jest.fn(),
      saveHon: jest.fn(),
      getSubscription: jest.fn(),
      saveSubscription: jest.fn(),
      findExpiredSubscriptions: jest.fn(),
      getActiveSubscriptionsToRenew: jest.fn(),
      saveHonEvent: jest.fn(),
      getHonEvents: jest.fn(),
    } as unknown as jest.Mocked<IHonRepository>;

    taskService = new TaskService(
      {} as CommandBus,
      {} as SystemStatusService,
      honRepository,
      {} as IPaymentRepository,
      {} as PortoneClient,
    );
  });

  describe('processAdminHonEvents', () => {
    it('executes RESET event only once when triggered concurrently', async () => {
      let resolveFindEvents!: (value: unknown[]) => void;
      (prisma.adminHonEventSetting.findMany as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFindEvents = resolve;
          }),
      );
      (prisma.hon.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-1', freeBalance: 48, paidBalance: 0 },
      ]);
      (prisma.honEvent.createMany as jest.Mock).mockReturnValue('createManyOp');
      (prisma.hon.updateMany as jest.Mock).mockReturnValue('updateManyOp');
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      const run1 = taskService.processAdminHonEvents();
      const run2 = taskService.processAdminHonEvents();

      resolveFindEvents([
        {
          id: 'event-1',
          type: 'RESET',
          amount: 50,
          isActive: true,
          startsAt: new Date(Date.now() - 10000),
          endsAt: null,
        },
      ]);

      await Promise.all([run1, run2]);

      expect(prisma.adminHonEventSetting.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.honEvent.createMany).toHaveBeenCalledTimes(1);
      expect(prisma.honEvent.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: 'user-1',
            type: 'ADMIN_PROVISION',
            amount: 2,
            freeAmount: 2,
            paidAmount: 0,
            balance: 50,
            description: '자동 이벤트 초기화',
          },
        ],
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('renewSubscriptions', () => {
    it('executes subscription renewal only once when triggered concurrently', async () => {
      let resolveExpired!: (value: unknown[]) => void;
      (honRepository.findExpiredSubscriptions as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveExpired = resolve;
          }),
      );

      const run1 = taskService.renewSubscriptions();
      const run2 = taskService.renewSubscriptions();

      resolveExpired([]);
      await Promise.all([run1, run2]);

      expect(honRepository.findExpiredSubscriptions).toHaveBeenCalledTimes(1);
    });
  });
});
