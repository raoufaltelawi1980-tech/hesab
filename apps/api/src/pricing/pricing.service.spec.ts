import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PricingService } from './pricing.service.js';
import {
  COUNTRY_ECONOMIC_LEVELS,
  PLAN_PRICES,
  PLAN_TIERS,
  PRICING_COUNTRIES,
  priceFor,
} from './pricing.constants.js';
import { PRICING_ERROR_CODES } from './pricing.errors.js';

const service = new PricingService();

function plansFor(response: ReturnType<PricingService['listPlans']>, level: string, tier: string) {
  const levelView = response.levels.find((entry) => entry.level === level);
  return levelView?.plans.find((entry) => entry.tier === tier) ?? null;
}

describe('PricingService.listPlans', () => {
  it('returns the three economic levels by default, with both plan tiers each', () => {
    const response = service.listPlans();
    expect(response.baseCurrency).toBe('USD');
    expect(response.country).toBeNull();
    expect(response.levels.map((level) => level.level)).toEqual([...COUNTRY_ECONOMIC_LEVELS]);
    for (const level of response.levels) {
      expect(level.plans.map((plan) => plan.tier)).toEqual([...PLAN_TIERS]);
    }
  });

  it('exposes every configured country with its economic level', () => {
    const response = service.listPlans();
    expect(response.countries).toHaveLength(PRICING_COUNTRIES.length);
    for (const country of PRICING_COUNTRIES) {
      expect(response.countries).toContainEqual({ ...country });
    }
  });

  it('always quotes prices in USD as decimal strings, never floats', () => {
    const response = service.listPlans();
    for (const level of response.levels) {
      for (const plan of level.plans) {
        for (const price of plan.prices) {
          expect(price.baseCurrency).toBe('USD');
          expect(typeof price.baseAmount).toBe('string');
          expect(price.baseAmount).toMatch(/^\d+\.\d{2}$/);
          expect(price.displayAmount).toBeNull();
          expect(price.displayCurrency).toBeNull();
          expect(price.displayRate).toBeNull();
        }
      }
    }
  });

  it('quotes the approved Level A prices (personal & business)', () => {
    const response = service.listPlans({ country: 'QA' });
    expect(plansFor(response, 'A', 'PERSONAL')?.prices).toEqual([
      { billingCycle: 'MONTHLY', baseAmount: '2.99', baseCurrency: 'USD', displayAmount: null, displayCurrency: null, displayRate: null },
      { billingCycle: 'YEARLY', baseAmount: '24.99', baseCurrency: 'USD', displayAmount: null, displayCurrency: null, displayRate: null },
    ]);
    expect(plansFor(response, 'A', 'BUSINESS')?.prices).toEqual([
      { billingCycle: 'MONTHLY', baseAmount: '9.99', baseCurrency: 'USD', displayAmount: null, displayCurrency: null, displayRate: null },
      { billingCycle: 'YEARLY', baseAmount: '89.00', baseCurrency: 'USD', displayAmount: null, displayCurrency: null, displayRate: null },
    ]);
  });

  it('quotes the approved Level B prices', () => {
    const response = service.listPlans({ country: 'EG' });
    expect(plansFor(response, 'B', 'PERSONAL')?.prices.map((price) => price.baseAmount)).toEqual([
      '1.99',
      '16.99',
    ]);
    expect(plansFor(response, 'B', 'BUSINESS')?.prices.map((price) => price.baseAmount)).toEqual([
      '5.99',
      '54.00',
    ]);
  });

  it('quotes the approved Level C prices', () => {
    const response = service.listPlans({ country: 'YE' });
    expect(plansFor(response, 'C', 'PERSONAL')?.prices.map((price) => price.baseAmount)).toEqual([
      '0.99',
      '8.99',
    ]);
    expect(plansFor(response, 'C', 'BUSINESS')?.prices.map((price) => price.baseAmount)).toEqual([
      '2.99',
      '27.00',
    ]);
  });

  it('matches the catalog table for every level/tier/cycle combination', () => {
    for (const level of COUNTRY_ECONOMIC_LEVELS) {
      for (const tier of PLAN_TIERS) {
        expect(priceFor(level, tier, 'MONTHLY')).toBe(PLAN_PRICES[level][tier].MONTHLY);
        expect(priceFor(level, tier, 'YEARLY')).toBe(PLAN_PRICES[level][tier].YEARLY);
      }
    }
  });

  it('maps a country to its economic level (case-insensitive)', () => {
    expect(service.listPlans({ country: 'qa' }).levels.map((level) => level.level)).toEqual(['A']);
    expect(service.listPlans({ country: 'Jo' }).levels.map((level) => level.level)).toEqual(['B']);
    expect(service.listPlans({ country: 'IN' }).levels.map((level) => level.level)).toEqual(['C']);
  });

  it('rejects an unsupported country with a clear code', () => {
    expect(() => service.listPlans({ country: 'US' })).toThrow(BadRequestException);
    try {
      service.listPlans({ country: 'US' });
    } catch (error) {
      expect((error as BadRequestException).message).toContain(
        PRICING_ERROR_CODES.COUNTRY_UNSUPPORTED,
      );
    }
  });

  it('rejects a malformed country code', () => {
    expect(() => service.listPlans({ country: 'QAT' })).toThrow(BadRequestException);
  });

  it('filters to a single plan tier when requested', () => {
    const response = service.listPlans({ country: 'SA', plan: 'BUSINESS' });
    const level = response.levels[0];
    expect(level.plans.map((plan) => plan.tier)).toEqual(['BUSINESS']);
  });

  it('rejects an unknown plan tier', () => {
    try {
      service.listPlans({ plan: 'ENTERPRISE' });
      throw new Error('expected rejection');
    } catch (error) {
      expect((error as BadRequestException).message).toContain(PRICING_ERROR_CODES.PLAN_UNKNOWN);
    }
  });

  it('filters to a single billing cycle when requested', () => {
    const response = service.listPlans({ country: 'AE', plan: 'PERSONAL', cycle: 'YEARLY' });
    const plan = plansFor(response, 'A', 'PERSONAL');
    expect(plan?.prices.map((price) => price.billingCycle)).toEqual(['YEARLY']);
    expect(plan?.prices[0].baseAmount).toBe('24.99');
  });

  it('rejects an unknown billing cycle', () => {
    expect(() => service.listPlans({ cycle: 'WEEKLY' })).toThrow(BadRequestException);
  });

  it('keeps prices stable regardless of how many filters are applied', () => {
    const full = service.listPlans({ country: 'KW' });
    const filtered = service.listPlans({ country: 'KW', plan: 'PERSONAL', cycle: 'MONTHLY' });
    expect(plansFor(full, 'A', 'PERSONAL')?.prices[0].baseAmount).toBe('2.99');
    expect(plansFor(filtered, 'A', 'PERSONAL')?.prices[0].baseAmount).toBe('2.99');
    expect(plansFor(filtered, 'A', 'PERSONAL')?.prices).toHaveLength(1);
  });

  it('never claims payment is implemented', () => {
    expect(service.listPlans().paymentImplemented).toBe(false);
    expect(service.listPlans({ country: 'QA' }).paymentImplemented).toBe(false);
  });

  it('does not expose a display-currency conversion it cannot perform', () => {
    const response = service.listPlans({ country: 'QA' });
    expect(response.display.available).toBe(false);
    expect(response.display.currency).toBeNull();
    expect(response.notes.length).toBeGreaterThan(0);
  });
});
