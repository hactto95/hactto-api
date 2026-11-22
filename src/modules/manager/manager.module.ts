import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ManagerController } from './presentation/manager.controller';
import { CommonModule } from '../../common/common.module';
import { UserModule } from '../user/user.module';

import { GatewayModule } from '../../gateway.module';

@Module({
  imports: [CommonModule, UserModule, GatewayModule, CqrsModule],
  controllers: [ManagerController],
  providers: [],
})
export class ManagerModule {}
