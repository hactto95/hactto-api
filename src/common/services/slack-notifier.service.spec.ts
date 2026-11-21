import { SlackNotifierService } from './slack-notifier.service';

describe('SlackNotifierService', () => {
  let service: SlackNotifierService;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    service = new SlackNotifierService();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should skip gracefully if no webhook url', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    const result = await service.notifyAiPostPublished({
      round: 1151,
      title: '테스트 제목',
      postId: 123,
    });
    expect(result).toBe(false);
  });

  it('should send payload to webhook when url is present', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    const globalFetch = global.fetch;

    let sentBody: any = null;
    (global as any).fetch = jest.fn().mockImplementation((url, opts) => {
      sentBody = JSON.parse(opts.body);
      return Promise.resolve({ ok: true, status: 200 });
    });

    const result = await service.notifyAiPostPublished({
      round: 1151,
      title: '원픽 번호 대공개',
      postId: 999,
    });

    expect(result).toBe(true);
    expect(sentBody.text).toContain('1151회');
    expect(sentBody.text).toContain('핵또');

    global.fetch = globalFetch;
  });
});
