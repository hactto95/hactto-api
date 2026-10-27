import { RedisController } from './redis.controller';
import { RedisService } from '../application/redis.service';
import { RequestParser } from '../../../common/utils/request-parser';
import { HonService } from '../../../modules/user/application/hon.service';
import * as crypto from 'crypto';

describe('RedisController', () => {
  let controller: RedisController;
  let redisService: jest.Mocked<Partial<RedisService>>;
  let requestParser: jest.Mocked<Partial<RequestParser>>;
  let honService: jest.Mocked<Partial<HonService>>;

  beforeEach(() => {
    redisService = {
      validateMasterKey: jest.fn(),
    };
    requestParser = {
      getIpOrThrow: jest.fn().mockReturnValue('127.0.0.1'),
      getUserId: jest.fn(),
    };
    honService = {
      getHon: jest.fn().mockResolvedValue({
        userId: 'auth-user-123',
        freeBalance: 45,
        paidBalance: 100,
      }),
      getSubscription: jest.fn().mockResolvedValue(null),
    };

    controller = new RedisController(
      redisService as unknown as RedisService,
      requestParser as unknown as RequestParser,
      honService as unknown as HonService,
    );
  });

  it('uses authenticated userId from requestParser when available', async () => {
    (requestParser.getUserId as jest.Mock).mockReturnValue('auth-user-123');

    const result = await controller.checkIp();

    expect(honService.getHon).toHaveBeenCalledWith('auth-user-123');
    expect(honService.getSubscription).toHaveBeenCalledWith('auth-user-123');
    expect(result.userId).toBe('auth-user-123');
    expect(result.hon).toEqual({
      userId: 'auth-user-123',
      freeBalance: 45,
      paidBalance: 100,
    });
  });

  it('falls back to IP hash userId when requestParser.getUserId returns undefined', async () => {
    (requestParser.getUserId as jest.Mock).mockReturnValue(undefined);
    const expectedIpHash = crypto
      .createHash('sha256')
      .update('127.0.0.1')
      .digest('hex')
      .substring(0, 16);

    const result = await controller.checkIp();

    expect(honService.getHon).toHaveBeenCalledWith(expectedIpHash);
    expect(honService.getSubscription).toHaveBeenCalledWith(expectedIpHash);
    expect(result.userId).toBe(expectedIpHash);
  });
});
