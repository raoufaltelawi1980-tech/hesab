/**
 * رموز رفض كتالوج التسعير. تُسبَق بها الرسالة العربية (`CODE: رسالة`) لأن
 * الردود نصّية في هذا الـ API. لا يحمل أي رمز سرًّا أو بيانات مستخدم.
 */
export const PRICING_ERROR_CODES = {
  /** رمز دولة غير مدعوم في التسعير التجريبي. */
  COUNTRY_UNSUPPORTED: 'PRICING_COUNTRY_UNSUPPORTED',
  /** نوع باقة غير معروف. */
  PLAN_UNKNOWN: 'PRICING_PLAN_UNKNOWN',
  /** دورة فوترة غير معروفة. */
  CYCLE_UNKNOWN: 'PRICING_CYCLE_UNKNOWN',
} as const;

export type PricingErrorCode = (typeof PRICING_ERROR_CODES)[keyof typeof PRICING_ERROR_CODES];
