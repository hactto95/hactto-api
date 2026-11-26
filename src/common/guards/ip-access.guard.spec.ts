import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { IpAccessGuard } from './ip-access.guard';
import { RequestParser } from '../utils/request-parser';
import { RedisService } from '../../helpers/redis/application/redis.service';
import { IUserRepository } from '../../modules/user/domain/ports/user.port';
import { prisma } from '../../libs/prisma';

jest.mock('../../libs/prisma', () => ({
  prisma: {
    block: {
      findFirst: jest.fn(),
    },
  },
}));

describe('IpAccessGuard', () => {
  let guard: IpAccessGuard;
  let repository: jest.Mocked<IUserRepository>;
  let requestParser: jest.Mocked<RequestParser>;
  let redisService: jest.Mocked<RedisService>;

  const createMockContext = (path = '/hactto/v1/user/me', method = 'GET') => {
    const setHeader = jest.fn();
    return {
      switchToHttp: () => ({
        getRequest: () => ({ path, method }),
        getResponse: () => ({ setHeader }),
      }),
      setHeaderMock: setHeader,
    } as unknown as ExecutionContext & { setHeaderMock: jest.Mock };
  };

  beforeEach(() => {
    repository = {
      insert: jest.fn(),
      findById: jest.fn(),
      updateIp: jest.fn(),
    };
    requestParser = {
      getMasterKey: jest.fn().mockReturnValue(undefined),
      getIpOrThrow: jest.fn().mockReturnValue('115.94.162.83'),
      getUserId: jest.fn().mockReturnValue('3bmsyejy'),
    } as unknown as jest.Mocked<RequestParser>;
    redisService = {
      validateMasterKey: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    guard = new IpAccessGuard(repository, requestParser, redisService);
    jest.clearAllMocks();
  });

  it('should allow access and update IP when an authenticated user accesses from a different IP', async () => {
    redisService.get.mockImplementation(async (key: string) => {
      if (key === 'user-blocked:3bmsyejy') return 'false';
      if (key === 'user-ip:3bmsyejy') return '58.122.160.59';
      return null;
    });

    const context = createMockContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(repository.updateIp).toHaveBeenCalledWith(
      '3bmsyejy',
      '115.94.162.83',
    );
    expect(redisService.set).toHaveBeenCalledWith(
      'user-ip:3bmsyejy',
      '115.94.162.83',
      86400 * 30,
    );
  });

  it('should block user when user is marked as blocked in redis', async () => {
    redisService.get.mockImplementation(async (key: string) => {
      if (key === 'user-blocked:3bmsyejy') return 'true';
      return null;
    });

    const context = createMockContext();
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should update IP in DB and Redis when savedIp is 0.0.0.0 from DB', async () => {
    redisService.get.mockResolvedValue(null);
    repository.findById.mockResolvedValue({
      id: '3bmsyejy',
      ip: '0.0.0.0',
    } as any);
    (prisma.block.findFirst as jest.Mock).mockResolvedValue(null);

    const context = createMockContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(repository.updateIp).toHaveBeenCalledWith(
      '3bmsyejy',
      '115.94.162.83',
    );
    expect(redisService.set).toHaveBeenCalledWith(
      'user-ip:3bmsyejy',
      '115.94.162.83',
      86400 * 30,
    );
  });
});
