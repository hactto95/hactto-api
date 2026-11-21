import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { HonService } from '../../user/application/hon.service';

@ApiTags('- Lottery Draw')
@Controller('lottery-draw')
export class LotteryDrawController {
  constructor(private readonly honService: HonService) {}

  @ApiOperation({ summary: '추첨 시작 전 HON 5개 차감 (구독자는 면제)' })
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('success.lottery_draw_start')
  @Post('start')
  async startDraw(
    @Req() req: any,
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) {
      throw new BadRequestException('로그인이 필요합니다.');
    }

    await this.honService.deductHon(userId, 5, '예측번호 추첨기 이용 (5 HON)');

    return {
      success: true,
      message: 'HON 5개가 사용되었습니다. 추첨을 시작합니다.',
    };
  }
}
