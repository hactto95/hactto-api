import { prisma } from '../../../../libs/prisma';

export const AI_ANALYST_USER_ID = 'AI_AGENT';

export async function ensureAiAnalystUser() {
  return await prisma.user.upsert({
    where: { id: AI_ANALYST_USER_ID },
    update: {
      nickname: '핵또 AI 분석관',
      avatarUrl: 'https://hactto.com/favicon.ico',
    },
    create: {
      id: AI_ANALYST_USER_ID,
      nickname: '핵또 AI 분석관',
      email: 'ai-analyst@hactto.com',
      avatarUrl: 'https://hactto.com/favicon.ico',
    },
  });
}
