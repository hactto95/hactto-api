import { Global, Module } from '@nestjs/common';
import { RequestParser } from './utils/request-parser';
import { AdminGuard } from './guards/admin.guard';
import { SystemStatusService } from './utils/system-status/system-status.service';
import { SystemStatusController } from './utils/system-status/system-status.controller';
import { UserCleanupTask } from './tasks/user-cleanup.task';
import { GeminiService } from './services/gemini.service';
import { SlackNotifierService } from './services/slack-notifier.service';

@Global()
@Module({
  controllers: [SystemStatusController],
  providers: [
    RequestParser,
    AdminGuard,
    SystemStatusService,
    UserCleanupTask,
    GeminiService,
    SlackNotifierService,
  ],
  exports: [
    RequestParser,
    AdminGuard,
    SystemStatusService,
    UserCleanupTask,
    GeminiService,
    SlackNotifierService,
  ],
})
export class CommonModule {}
