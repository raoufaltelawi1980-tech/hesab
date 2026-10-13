import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { EMAIL_ERROR_CODES } from './email.errors.js';

/**
 * تجريد مزوّد البريد. لا يوجد مزوّد مزيّف ينجح دائمًا في مسار الإنتاج:
 * مزوّد البيئة يقرأ إعداداته من متغيّرات البيئة، وإن غابت يرفض بوضوح.
 * الاختبارات تستخدم `MockEmailProvider` بديلًا صريحًا بلا إرسال حقيقي.
 */
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailSendResult = {
  provider: string;
  messageId: string | null;
};

export interface EmailProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

@Injectable()
export class EnvEmailProvider implements EmailProvider {
  readonly name = 'env';

  private from(): string {
    return process.env.EMAIL_FROM?.trim() ?? '';
  }

  private apiUrl(): string {
    return process.env.EMAIL_API_URL?.trim() ?? '';
  }

  private apiKey(): string {
    return process.env.EMAIL_API_KEY?.trim() ?? '';
  }

  private providerName(): string {
    return process.env.EMAIL_PROVIDER?.trim() || 'env';
  }

  /** يُعتبر مضبوطًا فقط عند وجود وجهة إرسال ومرسل معًا. */
  isConfigured(): boolean {
    return this.apiUrl().length > 0 && this.from().length > 0;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!message.to) {
      throw new ServiceUnavailableException(`${EMAIL_ERROR_CODES.RECIPIENT_REQUIRED}: لا مستلم للرسالة`);
    }
    if (!this.isConfigured()) {
      // لا مفتاح ولا سرّ في الرسالة — مجرّد دليل الإعداد المطلوب.
      throw new ServiceUnavailableException(
        `${EMAIL_ERROR_CODES.PROVIDER_NOT_CONFIGURED}: مزوّد البريد غير مضبوط. اضبط EMAIL_API_URL و EMAIL_FROM (و EMAIL_API_KEY عند الحاجة) ثم أعد المحاولة`,
      );
    }

    let response: Response;
    try {
      response = await fetch(this.apiUrl(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.apiKey() ? { authorization: `Bearer ${this.apiKey()}` } : {}),
        },
        body: JSON.stringify({
          from: this.from(),
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      });
    } catch {
      throw new ServiceUnavailableException(`${EMAIL_ERROR_CODES.PROVIDER_FAILED}: تعذّر الوصول إلى مزوّد البريد`);
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(`${EMAIL_ERROR_CODES.PROVIDER_FAILED}: فشل مزوّد البريد`);
    }

    let messageId: string | null = null;
    try {
      const payload = (await response.json()) as { id?: unknown; messageId?: unknown };
      const candidate = payload.id ?? payload.messageId;
      if (typeof candidate === 'string') messageId = candidate;
    } catch {
      messageId = null;
    }

    return { provider: this.providerName(), messageId };
  }
}

/**
 * مزوّد اختبارات فقط: يسجّل الرسائل في الذاكرة ولا يرسل شيئًا.
 * لا يُستخدم في الإنتاج، ولا يُربط في أي وحدة إنتاجية.
 */
@Injectable()
export class MockEmailProvider implements EmailProvider {
  readonly name = 'mock';
  readonly sent: EmailMessage[] = [];

  isConfigured(): boolean {
    return true;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.sent.push({ ...message });
    return { provider: 'mock', messageId: `mock-${this.sent.length}` };
  }
}
