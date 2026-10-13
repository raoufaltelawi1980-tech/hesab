/**
 * Stable rejection codes for the voice-input pipeline. They are prefixed to the
 * Arabic message (`CODE: رسالة`) because responses stay text-only in this API.
 * No code ever carries audio, a provider secret, or the full transcript.
 */
export const VOICE_ERROR_CODES = {
  /** لا مزوّد تفريغ مضبوط في البيئة، فلا تفريغ حقيقي. */
  PROVIDER_NOT_CONFIGURED: 'VOICE_PROVIDER_NOT_CONFIGURED',
  /** فشل المزوّد أثناء التفريغ. */
  PROVIDER_FAILED: 'VOICE_PROVIDER_FAILED',
  /** لا ملف صوتي في الطلب. */
  AUDIO_REQUIRED: 'VOICE_AUDIO_REQUIRED',
  /** حجم الملف يتجاوز الحدّ المسموح. */
  AUDIO_TOO_LARGE: 'VOICE_AUDIO_TOO_LARGE',
  /** امتداد أو نوع غير مدعوم. */
  AUDIO_TYPE_UNSUPPORTED: 'VOICE_AUDIO_TYPE_UNSUPPORTED',
  /** نص فارغ لا يُحلَّل. */
  TEXT_REQUIRED: 'VOICE_TEXT_REQUIRED',
  /** لم يُتعرف على نوع العملية أو المبلغ. */
  CARD_INCOMPLETE: 'VOICE_CARD_INCOMPLETE',
  /** محاولة تأكيد نفس البطاقة مرتين. */
  CARD_ALREADY_CONFIRMED: 'VOICE_CARD_ALREADY_CONFIRMED',
  /** عملة تختلف عن عملة الدفتر بلا سعر صرف. */
  EXCHANGE_RATE_REQUIRED: 'VOICE_EXCHANGE_RATE_REQUIRED',
} as const;

export type VoiceErrorCode = (typeof VOICE_ERROR_CODES)[keyof typeof VOICE_ERROR_CODES];
