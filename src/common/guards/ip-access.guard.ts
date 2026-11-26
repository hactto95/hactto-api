import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Scope,
} from '@nestjs/common';
import { RequestParser } from '../utils/request-parser';
import { RedisService } from '../../helpers/redis/application/redis.service';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../modules/user/domain/ports/user.port';
import { prisma } from '../../libs/prisma';

@Injectable({ scope: Scope.REQUEST })
export class IpAccessGuard implements CanActivate {
  private readonly logger = new Logger(IpAccessGuard.name);

  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly repository: IUserRepository,
    private readonly requestParser: RequestParser,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (request && request.path) {
      if (
        request.path.endsWith('/manager/inquiries') &&
        (request.method === 'POST' || request.method === 'GET')
      ) {
        return true;
      }

      if (
        request.path.endsWith('/auth/login') ||
        request.path.endsWith('/auth/refresh')
      ) {
        return true;
      }

      if (request.path.endsWith('/user/inquiries')) {
        const isGetBlock =
          request.method === 'GET' && request.query?.type === 'BLOCK';
        const isPostBlock =
          request.method === 'POST' && request.body?.type === 'BLOCK';
        if (isGetBlock || isPostBlock) {
          return true;
        }
      }
    }

    const masterKey = this.requestParser.getMasterKey();
    if (masterKey) {
      const isValidMasterKey =
        await this.redisService.validateMasterKey(masterKey);
      if (isValidMasterKey) {
        return true;
      }
    }

    const userId = this.requestParser.getUserId();
    if (!userId) {
      return true;
    }

    let ip = 'unknown';
    try {
      ip = this.requestParser.getIpOrThrow();
    } catch {
      // Allow fallback if IP cannot be resolved
    }

    const blockedRedisKey = `user-blocked:${userId}`;
    let isBlockedCache = await this.redisService.get(blockedRedisKey);

    if (isBlockedCache === 'true') {
      throw new ForbiddenException({
        message: '차단된 사용자입니다.',
        ip,
        userId,
      });
    }

    if (isBlockedCache === null) {
      const activeBlock = await prisma.block.findFirst({
        where: {
          userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      isBlockedCache = activeBlock ? 'true' : 'false';
      await this.redisService.set(blockedRedisKey, isBlockedCache, 86400 * 7); // 7일 캐싱
    }

    if (isBlockedCache === 'true') {
      throw new ForbiddenException({
        message: '차단된 사용자입니다.',
        ip,
        userId,
      });
    }

    return true;
  }
}
