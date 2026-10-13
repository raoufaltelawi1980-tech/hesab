import { ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvEmailProvider, MockEmailProvider } from './email.provider.js';

describe('EnvEmailProvider', () => {
  beforeEach(() => {
    delete process.env.EMAIL_API_URL;
    delete process.env.EMAIL_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_PROVIDER;
  });

  it('يعتبر نفسه غير مضبوط دون متغيّرات البيئة', () => {
    const provider = new EnvEmailProvider();
    expect(provider.isConfigured()).toBe(false);
  });

  it('يرفض بوضوح عند غياب الإعداد دون تسريب أسرار', async () => {
    const provider = new EnvEmailProvider();
    await expect(provider.send({ to: 'a@b.com', subject: 's', text: 't' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await provider.send({ to: 'a@b.com', subject: 's', text: 't' }).catch((error: ServiceUnavailableException) => {
      expect(error.message).toContain('EMAIL_PROVIDER_NOT_CONFIGURED');
      expect(error.message).toContain('EMAIL_API_URL');
    });
  });

  it('يرفض رسالة بلا مستلم', async () => {
    const provider = new EnvEmailProvider();
    await expect(provider.send({ to: '', subject: 's', text: 't' })).rejects.toThrow(
      /EMAIL_RECIPIENT_REQUIRED/,
    );
  });

  it('يرسل عبر HTTP ويعيد معرّف الرسالة عند النجاح', async () => {
    process.env.EMAIL_API_URL = 'https://mail.example/send';
    process.env.EMAIL_FROM = 'no-reply@hesab.example';
    process.env.EMAIL_API_KEY = 'secret-key';
    process.env.EMAIL_PROVIDER = 'resend';
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'msg-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new EnvEmailProvider();
    expect(provider.isConfigured()).toBe(true);
    const result = await provider.send({ to: 'a@b.com', subject: 's', text: 't' });

    expect(result).toEqual({ provider: 'resend', messageId: 'msg-1' });
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://mail.example/send');
    expect((options.headers as Record<string, string>).authorization).toBe('Bearer secret-key');
    expect(JSON.parse(options.body as string)).toMatchObject({
      from: 'no-reply@hesab.example',
      to: 'a@b.com',
      subject: 's',
      text: 't',
    });
  });

  it('يفشل بوضوح عند ردّ غير ناجح من المزوّد', async () => {
    process.env.EMAIL_API_URL = 'https://mail.example/send';
    process.env.EMAIL_FROM = 'no-reply@hesab.example';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));

    const provider = new EnvEmailProvider();
    await expect(provider.send({ to: 'a@b.com', subject: 's', text: 't' })).rejects.toThrow(
      /EMAIL_PROVIDER_FAILED/,
    );
  });
});

describe('MockEmailProvider', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('يسجّل الرسالة في الذاكرة بلا أي إرسال حقيقي', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const provider = new MockEmailProvider();

    expect(provider.isConfigured()).toBe(true);
    const result = await provider.send({ to: 'a@b.com', subject: 's', text: 't' });

    expect(result.messageId).toBe('mock-1');
    expect(provider.sent).toEqual([{ to: 'a@b.com', subject: 's', text: 't' }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
