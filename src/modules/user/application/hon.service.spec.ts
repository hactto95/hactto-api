import { HonService } from './hon.service';
import { IHonRepository } from '../domain/ports/hon.port';
import { IPaymentRepository } from '../domain/ports/payment.port';
import { PaymentController } from '../presentation/payment.controller';
import { PaymentService } from './payment.service';
import { RequestParser } from '../../../common/utils/request-parser';

describe('HonService & PaymentController', () => {
  let honService: HonService;
  let honRepository: jest.Mocked<IHonRepository>;
  let paymentRepository: jest.Mocked<IPaymentRepository>;

  beforeEach(() => {
    honRepository = {
      getHon: jest.fn(),
      saveHon: jest.fn(),
      getSubscription: jest.fn(),
      saveSubscription: jest.fn(),
      getActiveSubscriptionsToRenew: jest.fn(),
      saveHonEvent: jest.fn(),
      getHonEvents: jest.fn(),
    };
    paymentRepository = {
      saveEvent: jest.fn(),
      getEvents: jest.fn().mockResolvedValue([]),
      saveProjection: jest.fn(),
      getProjectionByOrderId: jest.fn(),
    };

    honService = new HonService(honRepository, paymentRepository);
  });

  describe('provisionHonByAdmin', () => {
    it('calculates newTotalBalance including newly added freeBalance when amount > 0', async () => {
      honRepository.getHon.mockResolvedValue({
        userId: 'user-1',
        freeBalance: 50,
        paidBalance: 10,
      });

      await honService.provisionHonByAdmin('user-1', 100);

      expect(honRepository.saveHon).toHaveBeenCalledWith({
        userId: 'user-1',
        freeBalance: 150,
        paidBalance: 10,
      });
      expect(honRepository.saveHonEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: 'ADMIN_PROVISION',
          amount: 100,
          freeAmount: 100,
          paidAmount: 0,
          balance: 160,
        }),
      );
    });

    it('deducts from paidBalance first and then freeBalance when amount < 0', async () => {
      honRepository.getHon.mockResolvedValue({
        userId: 'user-1',
        freeBalance: 50,
        paidBalance: 10,
      });

      await honService.provisionHonByAdmin('user-1', -30);

      expect(honRepository.saveHon).toHaveBeenCalledWith({
        userId: 'user-1',
        freeBalance: 30,
        paidBalance: 0,
      });
      expect(honRepository.saveHonEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: 'ADMIN_DEDUCT',
          amount: -30,
          freeAmount: -20,
          paidAmount: -10,
          balance: 30,
        }),
      );
    });
  });

  describe('deductHon', () => {
    it('exempts CANCELLED subscription that has not yet expired', async () => {
      const futureDate = new Date(Date.now() + 86400 * 1000);
      honRepository.getSubscription.mockResolvedValue({
        userId: 'user-1',
        plan: 'MONTHLY',
        status: 'CANCELLED',
        billingKey: 'bk-1',
        nextPaymentAt: futureDate,
        startsAt: new Date(),
        endsAt: futureDate,
      });

      await honService.deductHon('user-1', 5, '로또 예측 생성');

      expect(honRepository.saveHon).not.toHaveBeenCalled();
      expect(honRepository.saveHonEvent).not.toHaveBeenCalled();
    });

    it('still deducts paid HON on refund clawback (deductPaidFirst = true) even if subscription is ACTIVE', async () => {
      const futureDate = new Date(Date.now() + 86400 * 1000);
      honRepository.getSubscription.mockResolvedValue({
        userId: 'user-1',
        plan: 'MONTHLY',
        status: 'ACTIVE',
        billingKey: 'bk-1',
        nextPaymentAt: futureDate,
        startsAt: new Date(),
        endsAt: futureDate,
      });
      honRepository.getHon.mockResolvedValue({
        userId: 'user-1',
        freeBalance: 50,
        paidBalance: 30,
      });

      await honService.deductHon('user-1', 30, '환불 처리로 인한 회수', true);

      expect(honRepository.saveHon).toHaveBeenCalledWith({
        userId: 'user-1',
        freeBalance: 50,
        paidBalance: 0,
      });
    });
  });

  describe('PaymentController userId resolution', () => {
    it('uses RequestParser.getUserId() for ready and cancelSubscription when body userId is omitted', async () => {
      const mockPaymentService = {
        readyPayment: jest.fn().mockResolvedValue({
          toProjection: () => ({
            paymentId: 'pay-1',
            userId: 'jwt-user-1',
            amount: 1000,
            orderId: 'order-1',
            orderName: '30 HON',
            status: 'READY',
          }),
        }),
      } as unknown as PaymentService;
      const mockHonService = {
        cancelSubscription: jest.fn().mockResolvedValue(undefined),
      } as unknown as HonService;
      const mockRequestParser = {
        getUserId: jest.fn().mockReturnValue('jwt-user-1'),
      } as unknown as RequestParser;

      const controller = new PaymentController(
        mockPaymentService,
        mockHonService,
        mockRequestParser,
      );

      await controller.ready({
        amount: 1000,
        orderId: 'order-1',
        orderName: '30 HON',
      });
      expect(mockPaymentService.readyPayment).toHaveBeenCalledWith(
        'jwt-user-1',
        1000,
        'order-1',
        'order-name' === 'order-name' ? '30 HON' : '',
      );

      await controller.cancelSubscription(undefined as unknown as string);
      expect(mockHonService.cancelSubscription).toHaveBeenCalledWith(
        'jwt-user-1',
      );
    });
  });
});
