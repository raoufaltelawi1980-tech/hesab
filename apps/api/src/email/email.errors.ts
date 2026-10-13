/**
 * رموز رفض ثابتة لطبقة البريد. تُسبق الرسالة العربية بالرمز (`CODE: رسالة`)
 * لأن ردود هذا الـAPI نصّية فقط. لا يحمل أي رمز سرًّا ولا مفتاح مزوّد ولا رمزًا خامًا.
 */
export const EMAIL_ERROR_CODES = {
  /** لا مزوّد بريد مضبوط في البيئة، فلا إرسال حقيقي. */
  PROVIDER_NOT_CONFIGURED: 'EMAIL_PROVIDER_NOT_CONFIGURED',
  /** فشل المزوّد أثناء الإرسال. */
  PROVIDER_FAILED: 'EMAIL_PROVIDER_FAILED',
  /** رسالة بلا مستلم. */
  RECIPIENT_REQUIRED: 'EMAIL_RECIPIENT_REQUIRED',
} as const;

export type EmailErrorCode = (typeof EMAIL_ERROR_CODES)[keyof typeof EMAIL_ERROR_CODES];
