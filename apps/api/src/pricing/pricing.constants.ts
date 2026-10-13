/**
 * كتالوج تسعير باقات المنصة (تجريبي).
 *
 * هذا الملف هو **المصدر الوحيد للحقيقة** للأسعار والمستويات الاقتصادية وربط
 * الدول بها. لا تُكرَّر هذه الأرقام في أي مكان آخر، ولا تُعدَّل عبر API.
 *
 * الثوابت:
 * - عملة التسعير الأساسية هي USD، لا تتغيّر بتغيّر دولة المستخدم.
 * - السعر يُخزَّن **سلسلة عشرية** لا Float، حتى لا يفقد دقّته.
 * - الأسعار بالدولار لكل (مستوى اقتصادي × باقة × دورة).
 * - لا يوجد تحويل عملة بعد، فالأسعار تُعرض بالدولار فقط حتى يتوفّر مصدر أسعار صرف.
 */
import type { BillingCycle } from '@prisma/client';

/** عملة تسعير الاشتراك الأساسية الثابتة. */
export const PRICING_BASE_CURRENCY = 'USD' as const;

/** المستويات الاقتصادية للدول؛ A الأعلى، C الأدنى. */
export const COUNTRY_ECONOMIC_LEVELS = ['A', 'B', 'C'] as const;
export type CountryEconomicLevel = (typeof COUNTRY_ECONOMIC_LEVELS)[number];

/** نوع الباقة: شخصية أو تجارية. */
export const PLAN_TIERS = ['PERSONAL', 'BUSINESS'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

/** دورات الفوترة المعتمدة (من `BillingCycle` في المخطّط). */
export const BILLING_CYCLES = ['MONTHLY', 'YEARLY'] as const satisfies readonly BillingCycle[];

export const BILLING_CYCLE_LABELS: Record<BillingCycle, { ar: string; en: string }> = {
  MONTHLY: { ar: 'شهري', en: 'Monthly' },
  YEARLY: { ar: 'سنوي', en: 'Yearly' },
};

export const PLAN_TIER_LABELS: Record<PlanTier, { ar: string; en: string }> = {
  PERSONAL: { ar: 'شخصية', en: 'Personal' },
  BUSINESS: { ar: 'تجارية', en: 'Business' },
};

export const LEVEL_LABELS: Record<CountryEconomicLevel, { ar: string; en: string }> = {
  A: { ar: 'المستوى A', en: 'Level A' },
  B: { ar: 'المستوى B', en: 'Level B' },
  C: { ar: 'المستوى C', en: 'Level C' },
};

/** سعر باقة واحدة بدورتين، كسلاسل عشرية بالدولار. */
export type PlanPriceTable = Record<PlanTier, Record<BillingCycle, string>>;

/** الأسعار المعتمدة مبدئيًا بالدولار لكل مستوى اقتصادي. */
export const PLAN_PRICES: Record<CountryEconomicLevel, PlanPriceTable> = {
  A: {
    PERSONAL: { MONTHLY: '2.99', YEARLY: '24.99' },
    BUSINESS: { MONTHLY: '9.99', YEARLY: '89.00' },
  },
  B: {
    PERSONAL: { MONTHLY: '1.99', YEARLY: '16.99' },
    BUSINESS: { MONTHLY: '5.99', YEARLY: '54.00' },
  },
  C: {
    PERSONAL: { MONTHLY: '0.99', YEARLY: '8.99' },
    BUSINESS: { MONTHLY: '2.99', YEARLY: '27.00' },
  },
};

export type PricingCountry = {
  iso2: string;
  nameAr: string;
  nameEn: string;
  level: CountryEconomicLevel;
};

/**
 * الدول المدعومة صراحةً في التسعير التجريبي. الدول «المماثلة اقتصاديًا» لم تُعدَّد
 * بعد؛ أي دولة خارج هذه القائمة تُرفض بوضوح بدل تخمين مستواها.
 */
export const PRICING_COUNTRIES: readonly PricingCountry[] = [
  { iso2: 'QA', nameAr: 'قطر', nameEn: 'Qatar', level: 'A' },
  { iso2: 'AE', nameAr: 'الإمارات العربية المتحدة', nameEn: 'United Arab Emirates', level: 'A' },
  { iso2: 'SA', nameAr: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia', level: 'A' },
  { iso2: 'KW', nameAr: 'الكويت', nameEn: 'Kuwait', level: 'A' },
  { iso2: 'BH', nameAr: 'البحرين', nameEn: 'Bahrain', level: 'A' },
  { iso2: 'OM', nameAr: 'عُمان', nameEn: 'Oman', level: 'A' },
  { iso2: 'EG', nameAr: 'مصر', nameEn: 'Egypt', level: 'B' },
  { iso2: 'JO', nameAr: 'الأردن', nameEn: 'Jordan', level: 'B' },
  { iso2: 'MA', nameAr: 'المغرب', nameEn: 'Morocco', level: 'B' },
  { iso2: 'TN', nameAr: 'تونس', nameEn: 'Tunisia', level: 'B' },
  { iso2: 'IQ', nameAr: 'العراق', nameEn: 'Iraq', level: 'B' },
  { iso2: 'YE', nameAr: 'اليمن', nameEn: 'Yemen', level: 'C' },
  { iso2: 'SD', nameAr: 'السودان', nameEn: 'Sudan', level: 'C' },
  { iso2: 'PK', nameAr: 'باكستان', nameEn: 'Pakistan', level: 'C' },
  { iso2: 'BD', nameAr: 'بنغلاديش', nameEn: 'Bangladesh', level: 'C' },
  { iso2: 'IN', nameAr: 'الهند', nameEn: 'India', level: 'C' },
  { iso2: 'ID', nameAr: 'إندونيسيا', nameEn: 'Indonesia', level: 'C' },
  { iso2: 'NG', nameAr: 'نيجيريا', nameEn: 'Nigeria', level: 'C' },
  { iso2: 'PH', nameAr: 'الفلبين', nameEn: 'Philippines', level: 'C' },
];

/** يبحث عن دولة مدعومة بمعرّف ISO2 (غير حساس لحالة الأحرف). */
export function findPricingCountry(iso2: string): PricingCountry | null {
  const needle = iso2.trim().toUpperCase();
  return PRICING_COUNTRIES.find((country) => country.iso2 === needle) ?? null;
}

/** يعيد مستوى الدولة الاقتصادي، أو `null` إن كانت غير مدعومة. */
export function levelForCountry(iso2: string): CountryEconomicLevel | null {
  return findPricingCountry(iso2)?.level ?? null;
}

/** يعيد سعر باقة بمستوى ودورة محدَّدين (سلسلة عشرية بالدولار). */
export function priceFor(
  level: CountryEconomicLevel,
  tier: PlanTier,
  cycle: BillingCycle,
): string {
  return PLAN_PRICES[level][tier][cycle];
}
