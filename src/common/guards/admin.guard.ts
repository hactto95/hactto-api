import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RedisService } from '../../helpers/redis/application/redis.service';
import { RequestParser } from '../utils/request-parser';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
    private readonly requestParser: RequestParser,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const masterKey: string = this.requestParser.getMasterKey();

    if (masterKey) {
      let ip = 'unknown';
      try {
        ip = this.requestParser.getIpOrThrow();
      } catch {}
      const userId = this.requestParser.getUserId();

      // Check master key
      const isValidMasterKey: boolean =
        await this.redisService.validateMasterKey(masterKey, { ip, userId });
      if (!isValidMasterKey) throw new ForbiddenException('Invalid Master Key');
      return true;
    }

    return false;
  }
}
