import { Inject, Injectable } from '@nestjs/common';
import {
  EMAIL_PROVIDER,
  type EmailMessage,
  type EmailProvider,
  type EmailSendResult,
} from './email.provider.js';
import { memberInvitationTemplate, passwordResetTemplate } from './email.templates.js';

/**
 * واجهة الإرسال الوحيدة التي تستخدمها بقية الوحدات. تُغلِّف المزوّد المضبوط
 * وتبني نصّ القالب المناسب. لا تسجّل أي رسالة أو رمز، ولا تُعيد أسرار المزوّد.
 */
@Injectable()
export class EmailService {
  constructor(@Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider) {}

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    return this.provider.send(message);
  }

  /** رابط استعادة كلمة المرور في البريد. يحمل الرمز الخام المقصود، ولا يُسجَّل. */
  async sendPasswordReset(input: {
    to: string;
    locale?: string | null;
    resetUrl: string;
    expiresInMinutes: number;
  }): Promise<EmailSendResult> {
    const { subject, text } = passwordResetTemplate(input);
    return this.provider.send({ to: input.to, subject, text });
  }

  /** بريد دعوة عضو جديد إلى دفتر قائم. لا يحمل أي صلاحية بذاته. */
  async sendMemberInvitation(input: {
    to: string;
    locale?: string | null;
    ledgerName: string;
    inviterEmail: string;
    inviteUrl: string;
  }): Promise<EmailSendResult> {
    const { subject, text } = memberInvitationTemplate(input);
    return this.provider.send({ to: input.to, subject, text });
  }
}
