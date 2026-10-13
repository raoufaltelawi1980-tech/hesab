import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvTranscriptionProvider } from './transcription.provider.js';

const ORIGINAL_ENV = { ...process.env };

function input() {
  return {
    buffer: Buffer.from('audio-bytes'),
    mimetype: 'audio/webm',
    filename: 'clip.webm',
    language: 'ar',
  };
}

describe('EnvTranscriptionProvider', () => {
  let provider: EnvTranscriptionProvider;

  beforeEach(() => {
    provider = new EnvTranscriptionProvider();
    delete process.env.VOICE_TRANSCRIPTION_ENDPOINT;
    delete process.env.VOICE_TRANSCRIPTION_API_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it('يعتبر نفسه غير مضبوط دون متغيّر البيئة', () => {
    expect(provider.isConfigured()).toBe(false);
  });

  it('يرفض بوضوح عند غياب الإعداد دون تسريب أسرار', async () => {
    await expect(provider.transcribe(input())).rejects.toBeInstanceOf(ServiceUnavailableException);
    await provider.transcribe(input()).catch((error: ServiceUnavailableException) => {
      const message = error.message;
      expect(message).toContain('VOICE_PROVIDER_NOT_CONFIGURED');
      expect(message).toContain('VOICE_TRANSCRIPTION_ENDPOINT');
    });
  });

  it('يرسل الصوت ويعيد النص والعملة والثقة عند النجاح', async () => {
    process.env.VOICE_TRANSCRIPTION_ENDPOINT = 'https://provider.example/transcribe';
    process.env.VOICE_TRANSCRIPTION_API_KEY = 'secret-key';
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ text: ' وارد 100 ', language: 'ar', confidence: 0.9 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    expect(provider.isConfigured()).toBe(true);
    const result = await provider.transcribe(input());

    expect(result).toEqual({ text: 'وارد 100', language: 'ar', confidence: 0.9 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
    expect(options.body).toBeInstanceOf(FormData);
  });

  it('يفشل بوضوح عند ردّ غير ناجح من المزوّد', async () => {
    process.env.VOICE_TRANSCRIPTION_ENDPOINT = 'https://provider.example/transcribe';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));

    await expect(provider.transcribe(input())).rejects.toThrow(/VOICE_PROVIDER_FAILED/);
  });

  it('يفشل عند ردّ نص فارغ', async () => {
    process.env.VOICE_TRANSCRIPTION_ENDPOINT = 'https://provider.example/transcribe';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ text: '   ' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    await expect(provider.transcribe(input())).rejects.toThrow(/VOICE_PROVIDER_FAILED/);
  });
});
