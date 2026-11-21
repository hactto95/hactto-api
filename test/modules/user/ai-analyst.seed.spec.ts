import { ensureAiAnalystUser, AI_ANALYST_USER_ID } from '../../../src/modules/user/infrastructure/seeds/ai-analyst.seed';
import { prisma } from '../../../src/libs/prisma';

jest.mock('../../../src/libs/prisma', () => ({
  prisma: {
    user: {
      upsert: jest.fn(),
    },
  },
}));

describe('ensureAiAnalystUser', () => {
  it('should ensure AI Analyst user exists with fixed ID and nickname', async () => {
    const mockUser = {
      id: AI_ANALYST_USER_ID,
      nickname: '핵또 AI 분석관',
      email: 'ai-analyst@hactto.com',
      avatarUrl: 'https://hactto.com/favicon.ico',
    };

    (prisma.user.upsert as jest.Mock).mockResolvedValue(mockUser);

    const user = await ensureAiAnalystUser();
    expect(user).toBeDefined();
    expect(user.id).toBe('AI_AGENT');
    expect(user.nickname).toBe('핵또 AI 분석관');
    expect(prisma.user.upsert).toHaveBeenCalledWith({
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
  });
});
