import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { VOICE_ERROR_CODES } from './voice.errors.js';

/**
 * واجهة مزوّد التفريغ الصوتي. لا يوجد مزوّد مزيّف ينجح دائمًا في مسار الإنتاج:
 * مزوّد البيئة يقرأ إعداداته من متغيّرات البيئة، وإن غابت يرفض بوضوح.
 */
export const TRANSCRIPTION_PROVIDER = 'VOICE_TRANSCRIPTION_PROVIDER';

export type TranscriptionInput = {
  buffer: Buffer;
  mimetype: string;
  filename: string;
  language?: string;
};

export type TranscriptionResult = {
  text: string;
  language: string;
  confidence: number | null;
};

export interface TranscriptionProvider {
  readonly name: string;
  isConfigured(): boolean;
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

@Injectable()
export class EnvTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'env';

  private endpoint(): string {
    return process.env.VOICE_TRANSCRIPTION_ENDPOINT?.trim() ?? '';
  }

  private apiKey(): string {
    return process.env.VOICE_TRANSCRIPTION_API_KEY?.trim() ?? '';
  }

  isConfigured(): boolean {
    return this.endpoint().length > 0;
  }

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const endpoint = this.endpoint();
    if (!endpoint) {
      // لا مفتاح ولا سرّ في الرسالة — مجرّد دليل الإعداد المطلوب.
      throw new ServiceUnavailableException(
        `${VOICE_ERROR_CODES.PROVIDER_NOT_CONFIGURED}: مزوّد التفريغ الصوتي غير مضبوط. اضبط VOICE_TRANSCRIPTION_ENDPOINT (وVOICE_TRANSCRIPTION_API_KEY عند الحاجة) ثم أعد المحاولة`,
      );
    }

    const form = new FormData();
    form.append(
      'file',
      new Blob([input.buffer as unknown as BlobPart], { type: input.mimetype || 'application/octet-stream' }),
      input.filename,
    );
    if (input.language) form.append('language', input.language);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: this.apiKey() ? { Authorization: `Bearer ${this.apiKey()}` } : {},
        body: form,
      });
    } catch {
      throw new ServiceUnavailableException(
        `${VOICE_ERROR_CODES.PROVIDER_FAILED}: تعذّر الوصول إلى مزوّد التفريغ`,
      );
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(`${VOICE_ERROR_CODES.PROVIDER_FAILED}: فشل مزوّد التفريغ`);
    }

    const payload = (await response.json()) as {
      text?: unknown;
      language?: unknown;
      confidence?: unknown;
    };
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    if (!text) {
      throw new ServiceUnavailableException(
        `${VOICE_ERROR_CODES.PROVIDER_FAILED}: مزوّد التفريغ أعاد نصًّا فارغًا`,
      );
    }

    return {
      text,
      language: typeof payload.language === 'string' ? payload.language : (input.language ?? 'ar'),
      confidence: typeof payload.confidence === 'number' ? payload.confidence : null,
    };
  }
}
