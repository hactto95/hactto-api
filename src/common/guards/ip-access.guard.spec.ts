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

  const createMockContext = (
    path = '/hactto/v1/user/me',
    method = 'GET',
    extra: { query?: any; body?: any } = {},
  ) => {
    const setHeader = jest.fn();
    return {
      switchToHttp: () => ({
        getRequest: () => ({ path, method, ...extra }),
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

  it('should allow unauthenticated requests without querying Redis or DB', async () => {
    requestParser.getUserId.mockReturnValue(undefined);

    const context = createMockContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(redisService.get).not.toHaveBeenCalled();
    expect(repository.updateIp).not.toHaveBeenCalled();
  });

  it('should allow authenticated non-blocked user without updating IP on every request', async () => {
    redisService.get.mockImplementation(async (key: string) => {
      if (key === 'user-blocked:3bmsyejy') return 'false';
      return null;
    });

    const context = createMockContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(repository.updateIp).not.toHaveBeenCalled();
    expect(redisService.set).not.toHaveBeenCalled();
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

  it('should cache block status from DB when Redis cache is empty', async () => {
    redisService.get.mockResolvedValue(null);
    (prisma.block.findFirst as jest.Mock).mockResolvedValue(null);

    const context = createMockContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(redisService.set).toHaveBeenCalledWith(
      'user-blocked:3bmsyejy',
      'false',
      86400 * 7,
    );
  });

  it('should allow blocked user to access BLOCK inquiries and auth refresh', async () => {
    redisService.get.mockResolvedValue('true');

    const blockInquiryCtx = createMockContext(
      '/hactto/v1/user/inquiries',
      'GET',
      { query: { type: 'BLOCK' } },
    );
    expect(await guard.canActivate(blockInquiryCtx)).toBe(true);

    const refreshCtx = createMockContext('/hactto/v1/auth/refresh', 'POST');
    expect(await guard.canActivate(refreshCtx)).toBe(true);
  });
});
