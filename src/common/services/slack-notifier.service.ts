import { Injectable, Logger } from '@nestjs/common';

export interface AiPostPublishNotification {
  round: number;
  title: string;
  postId: number;
}

export interface AdminLoginNotification {
  ip: string;
  userId?: string;
}

export interface UserSignupNotification {
  id: string;
  email: string;
  nickname: string;
  totalMembers?: number;
}

@Injectable()
export class SlackNotifierService {
  private readonly logger = new Logger(SlackNotifierService.name);

  async notifyAiPostPublished(
    data: AiPostPublishNotification,
  ): Promise<boolean> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      this.logger.debug(
        'SLACK_WEBHOOK_URL is not set. Skipping Slack notification.',
      );
      return false;
    }

    const appUrl = process.env.APP_URL || 'https://hactto.com';
    const postUrl = `${appUrl}/dashboard/board?postId=${data.postId}`;

    const payload = {
      text: `🎉 *[핵또] 제 ${data.round}회 AI 주간 분석 노하우 게시글 자동 발행 완료!*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🤖 제 ${data.round}회 AI 분석관 노하우 글 발행 완료`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*제목:* <${postUrl}|${data.title}>\n*게시글 ID:* #${data.postId}\n*작성자:* 핵또 AI 분석관\n*발행 시간:* ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '게시글 보러가기 ➔',
                emoji: true,
              },
              url: postUrl,
              style: 'primary',
            },
          ],
        },
      ],
    };

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        this.logger.error(`Slack webhook failed with status: ${res.status}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error('Failed to send Slack notification:', err);
      return false;
    }
  }

  async notifyAiPostFailed(round: number, error: string): Promise<boolean> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return false;

    const payload = {
      text: `🚨 *[핵또 경보] 제 ${round}회 AI 분석글 자동 발행 실패!*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 제 ${round}회 AI 분석글 발행 실패`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*사유:* \`\`\`${error}\`\`\`\n*발생 시간:* ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
          },
        },
      ],
    };

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      return true;
    } catch {
      return false;
    }
  }

  async notifyAdminLogin(data: AdminLoginNotification): Promise<boolean> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return false;

    const nowKst = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
    });

    const payload = {
      text: `🔐 *[핵또 보안] 관리자(Admin) OTP 인증 로그인 발생!*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🔐 [핵또] 관리자(Admin) 로그인 알림`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*접속 IP:* \`${data.ip}\`\n*방문자/유저 ID:* \`${data.userId || 'N/A'}\`\n*접속 시간:* ${nowKst}`,
          },
        },
      ],
    };

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch (err) {
      this.logger.error('Failed to send admin login Slack notification:', err);
      return false;
    }
  }

  async notifyUserSignup(data: UserSignupNotification): Promise<boolean> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return false;

    const nowKst = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
    });

    const memberCountText =
      data.totalMembers !== undefined
        ? `\n*누적 가입 회원 수:* *${data.totalMembers.toLocaleString()}명*`
        : '';

    const payload = {
      text: `🎊 *[핵또] 신규 회원 가입 완료! (${data.nickname})*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🎊 [핵또] 신규 회원가입 알림`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*닉네임:* *${data.nickname}*\n*이메일:* \`${data.email}\`\n*회원 ID:* \`${data.id}\`${memberCountText}\n*가입 시간:* ${nowKst}`,
          },
        },
      ],
    };

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch (err) {
      this.logger.error('Failed to send user signup Slack notification:', err);
      return false;
    }
  }
}
