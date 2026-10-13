import { BadRequestException, Injectable } from '@nestjs/common';
import type { BillingCycle } from '@prisma/client';
import {
  BILLING_CYCLES,
  COUNTRY_ECONOMIC_LEVELS,
  LEVEL_LABELS,
  PLAN_TIERS,
  PLAN_TIER_LABELS,
  PRICING_BASE_CURRENCY,
  PRICING_COUNTRIES,
  findPricingCountry,
  priceFor,
  type CountryEconomicLevel,
  type PlanTier,
} from './pricing.constants.js';
import { PRICING_ERROR_CODES } from './pricing.errors.js';

export type ListPlansQuery = {
  country?: string;
  plan?: string;
  cycle?: string;
};

export type PlanPriceView = {
  billingCycle: BillingCycle;
  /** السعر بالدولار، سلسلة عشرية لا رقم عشري. */
  baseAmount: string;
  baseCurrency: typeof PRICING_BASE_CURRENCY;
  /** لا يوجد تحويل عملة بعد؛ النسخة المعروضة بالعملة الأخرى غير متوفّرة. */
  displayAmount: null;
  displayCurrency: null;
  displayRate: null;
};

export type PlanView = {
  tier: PlanTier;
  nameAr: string;
  nameEn: string;
  prices: PlanPriceView[];
};

export type LevelView = {
  level: CountryEconomicLevel;
  nameAr: string;
  nameEn: string;
  plans: PlanView[];
};

export type PricingCountryView = {
  iso2: string;
  nameAr: string;
  nameEn: string;
  level: CountryEconomicLevel;
};

export type PricingResponse = {
  baseCurrency: typeof PRICING_BASE_CURRENCY;
  /** الدفع الحقيقي غير منفَّذ في هذه المهمة. */
  paymentImplemented: false;
  /** الدولة المختارة إن حُدِّدت. */
  country: PricingCountryView | null;
  /** كل الدول المدعومة في الكتالوج التجريبي. */
  countries: PricingCountryView[];
  /** المستويات المعروضة (مستوى الدولة المختارة أو المستويات الثلاثة). */
  levels: LevelView[];
  display: {
    currency: null;
    available: false;
    noteAr: string;
    noteEn: string;
  };
  notes: { ar: string; en: string }[];
};

function reject(code: string, messageAr: string): never {
  throw new BadRequestException(`${code}: ${messageAr}`);
}

@Injectable()
export class PricingService {
  /**
   * يعرض كتالوج الأسعار، اختياريًا مُصفّى بالدولة (لمستواها الاقتصادي) ونوع
   * الباقة ودورة الفوترة. لا يقرأ قاعدة البيانات: الكتالوج مصدره `pricing.constants.ts`.
   */
  listPlans(query: ListPlansQuery = {}): PricingResponse {
    const country = this.resolveCountry(query.country);
    const tier = this.resolveTier(query.plan);
    const cycle = this.resolveCycle(query.cycle);

    const levelsToShow: CountryEconomicLevel[] = country
      ? [country.level]
      : [...COUNTRY_ECONOMIC_LEVELS];

    const levels = levelsToShow.map((level) => this.buildLevel(level, tier, cycle));

    return {
      baseCurrency: PRICING_BASE_CURRENCY,
      paymentImplemented: false,
      country,
      countries: PRICING_COUNTRIES.map((entry) => ({ ...entry })),
      levels,
      display: {
        currency: null,
        available: false,
        noteAr: 'التحويل إلى عملة العرض غير متوفّر بعد؛ تُعرض الأسعار بالدولار الأمريكي.',
        noteEn: 'Display-currency conversion is not available yet; prices are shown in USD.',
      },
      notes: [
        {
          ar: 'الأسعار تجريبية معتمدة مبدئيًا وقابلة للتغيير.',
          en: 'Prices are experimental and may change.',
        },
        {
          ar: 'عملة التسعير الأساسية هي الدولار الأمريكي (USD) ولا تتغيّر بتغيّر الدولة.',
          en: 'The base pricing currency is USD and does not change with the country.',
        },
        {
          ar: 'لا يوجد دفع حقيقي في هذه المرحلة؛ محاكاة الاشتراك فقط.',
          en: 'No real payment at this stage; the subscription is simulated only.',
        },
      ],
    };
  }

  private buildLevel(
    level: CountryEconomicLevel,
    tier: PlanTier | null,
    cycle: BillingCycle | null,
  ): LevelView {
    const tiers = tier ? [tier] : [...PLAN_TIERS];
    return {
      level,
      nameAr: LEVEL_LABELS[level].ar,
      nameEn: LEVEL_LABELS[level].en,
      plans: tiers.map((entry) => ({
        tier: entry,
        nameAr: PLAN_TIER_LABELS[entry].ar,
        nameEn: PLAN_TIER_LABELS[entry].en,
        prices: (cycle ? [cycle] : [...BILLING_CYCLES]).map((billingCycle) => ({
          billingCycle,
          baseAmount: priceFor(level, entry, billingCycle),
          baseCurrency: PRICING_BASE_CURRENCY,
          displayAmount: null,
          displayCurrency: null,
          displayRate: null,
        })),
      })),
    };
  }

  private resolveCountry(raw?: string): PricingCountryView | null {
    if (raw === undefined || raw === null || raw.trim() === '') return null;
    const found = findPricingCountry(raw);
    if (!found) {
      reject(
        PRICING_ERROR_CODES.COUNTRY_UNSUPPORTED,
        'الدولة غير مدعومة في التسعير التجريبي.',
      );
    }
    return { ...found };
  }

  private resolveTier(raw?: string): PlanTier | null {
    if (raw === undefined || raw === null || raw.trim() === '') return null;
    const needle = raw.trim().toUpperCase();
    if (!(PLAN_TIERS as readonly string[]).includes(needle)) {
      reject(
        PRICING_ERROR_CODES.PLAN_UNKNOWN,
        'نوع الباقة غير معروف (المتاح: PERSONAL أو BUSINESS).',
      );
    }
    return needle as PlanTier;
  }

  private resolveCycle(raw?: string): BillingCycle | null {
    if (raw === undefined || raw === null || raw === '') return null;
    const needle = raw.trim().toUpperCase();
    if (!BILLING_CYCLES.includes(needle as BillingCycle)) {
      reject(
        PRICING_ERROR_CODES.CYCLE_UNKNOWN,
        'دورة الفوترة غير معروفة (المتاح: MONTHLY أو YEARLY).',
      );
    }
    return needle as BillingCycle;
  }
}
