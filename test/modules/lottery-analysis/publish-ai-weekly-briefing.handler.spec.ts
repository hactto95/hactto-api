import { PublishAiWeeklyBriefingHandler } from '../../../src/modules/lottery-analysis/application/command-handlers/publish-ai-weekly-briefing.handler';
import { PublishAiWeeklyBriefingCommand } from '../../../src/modules/lottery-analysis/application/commands/publish-ai-weekly-briefing.command';
import { prisma } from '../../../src/libs/prisma';

jest.mock('../../../src/libs/prisma', () => ({
  prisma: {
    post: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      upsert: jest.fn(),
    },
    prediction: {
      findMany: jest.fn(),
    },
    winningNumber: {
      findMany: jest.fn(),
    },
  },
}));

describe('PublishAiWeeklyBriefingHandler', () => {
  let handler: PublishAiWeeklyBriefingHandler;
  let queryBus: any;
  let geminiService: any;
  let slackNotifierService: any;

  beforeEach(() => {
    queryBus = {
      execute: jest.fn(),
    };
    geminiService = {
      generateBriefing: jest.fn(),
    };
    slackNotifierService = {
      notifyAiPostPublished: jest.fn(),
      notifyAiPostFailed: jest.fn(),
    };

    handler = new PublishAiWeeklyBriefingHandler(
      queryBus,
      geminiService,
      slackNotifierService,
    );
  });

  it('should skip publishing if post already exists for the episode and not force', async () => {
    queryBus.execute.mockResolvedValue({
      episode: 1150,
      getNumberArray: () => [1, 2, 3, 4, 5, 6, 7],
    });

    (prisma.post.findFirst as jest.Mock).mockResolvedValue({
      id: 999,
      lottoRound: 1150,
      title: '기존 글',
    });

    const result = await handler.execute(
      new PublishAiWeeklyBriefingCommand(1150),
    );

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.postId).toBe(999);
    expect(geminiService.generateBriefing).not.toHaveBeenCalled();
  });

  it('should update existing post if force is true', async () => {
    queryBus.execute.mockResolvedValue({
      episode: 1150,
      getNumberArray: () => [1, 2, 3, 4, 5, 6, 7],
    });

    (prisma.post.findFirst as jest.Mock).mockResolvedValue({
      id: 999,
      lottoRound: 1150,
      title: '기존 잘린 글',
    });
    (prisma.user.upsert as jest.Mock).mockResolvedValue({ id: 'AI_AGENT' });
    (prisma.winningNumber.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.prediction.findMany as jest.Mock).mockResolvedValue([]);

    geminiService.generateBriefing.mockResolvedValue({
      title: '새로운 완전한 타이틀',
      content: '새로운 완전한 본문',
    });

    (prisma.post.update as jest.Mock).mockResolvedValue({
      id: 999,
      title: '새로운 완전한 타이틀',
    });

    const result = await handler.execute(
      new PublishAiWeeklyBriefingCommand(1150, true),
    );

    expect(result.success).toBe(true);
    expect(result.postId).toBe(999);
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: 999 },
      data: {
        title: '새로운 완전한 타이틀',
        content: '새로운 완전한 본문',
        isAi: true,
        isAdmin: true,
        category: 'KNOWHOW',
      },
    });
    expect(slackNotifierService.notifyAiPostPublished).toHaveBeenCalledWith({
      round: 1150,
      title: '새로운 완전한 타이틀',
      postId: 999,
    });
  });

  it('should generate briefing, save post and notify slack on new round', async () => {
    queryBus.execute.mockResolvedValue({
      episode: 1150,
      getNumberArray: () => [3, 8, 19, 24, 33, 42, 7],
    });

    (prisma.post.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.user.upsert as jest.Mock).mockResolvedValue({ id: 'AI_AGENT' });
    (prisma.winningNumber.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.prediction.findMany as jest.Mock).mockResolvedValue([]);

    geminiService.generateBriefing.mockResolvedValue({
      title: '테스트 타이틀',
      content: '테스트 본문',
    });

    (prisma.post.create as jest.Mock).mockResolvedValue({
      id: 100,
      title: '테스트 타이틀',
    });

    const result = await handler.execute(
      new PublishAiWeeklyBriefingCommand(1150),
    );

    expect(result.success).toBe(true);
    expect(result.postId).toBe(100);
    expect(prisma.post.create).toHaveBeenCalledWith({
      data: {
        userId: 'AI_AGENT',
        category: 'KNOWHOW',
        title: '테스트 타이틀',
        content: '테스트 본문',
        lottoRound: 1150,
        isAdmin: true,
        isAi: true,
      },
    });
    expect(slackNotifierService.notifyAiPostPublished).toHaveBeenCalledWith({
      round: 1150,
      title: '테스트 타이틀',
      postId: 100,
    });
  });
});
