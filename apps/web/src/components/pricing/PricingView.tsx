"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, EmptyState, ErrorMessage, LoadingBlock } from "@/components/Feedback";
import { Field, Select } from "@/components/Form";
import { useLocale, useTranslations } from "@/components/LocaleProvider";
import { useSession } from "@/components/SessionProvider";
import {
  fetchPricingCatalog,
  type BillingCycle,
  type PlanTier,
  type PricingCatalog,
  type PricingCountry,
} from "@/lib/api-client";
import type { MessageKey } from "@/lib/messages";

type Loaded = { key: string; data: PricingCatalog | null; error: unknown };

const CYCLE_LABEL_KEYS: Record<BillingCycle, MessageKey> = {
  MONTHLY: "price.monthly",
  YEARLY: "price.yearly",
};

function countryName(locale: string, country: PricingCountry): string {
  return locale === "ar" ? country.nameAr : country.nameEn;
}

export function PricingView() {
  const t = useTranslations();
  const { locale } = useLocale();
  const { token } = useSession();

  const [countryIso, setCountryIso] = useState("");
  const [tier, setTier] = useState<"" | PlanTier>("");
  const [cycle, setCycle] = useState<"" | BillingCycle>("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>({ key: "", data: null, error: null });

  const requestKey = `${token ?? "anon"}:${reloadKey}`;
  const fresh = loaded.key === requestKey;
  const catalog = fresh ? loaded.data : null;
  const error = fresh ? loaded.error : null;
  const busy = !fresh;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const key = `${token ?? "anon"}:${reloadKey}`;
    void (async () => {
      try {
        const data = await fetchPricingCatalog(token, undefined, signal);
        if (signal.aborted) return;
        setLoaded({ key, data, error: null });
      } catch (caught) {
        if (signal.aborted) return;
        setLoaded({ key, data: null, error: caught });
      }
    })();
    return () => controller.abort();
  }, [token, reloadKey]);

  const selectedCountry =
    catalog?.countries.find((entry) => entry.iso2 === countryIso) ?? null;

  const visibleLevels =
    catalog?.levels.filter((level) => !selectedCountry || level.level === selectedCountry.level) ??
    [];

  return (
    <AppShell title={t("price.title")} subtitle={t("price.subtitle")}>
      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("price.country")} htmlFor="price-country">
              <Select
                id="price-country"
                value={countryIso}
                onChange={(event) => setCountryIso(event.target.value)}
              >
                <option value="">{t("price.allCountries")}</option>
                {(catalog?.countries ?? []).map((entry) => (
                  <option key={entry.iso2} value={entry.iso2}>
                    {countryName(locale, entry)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("price.planType")} htmlFor="price-plan">
              <Select
                id="price-plan"
                value={tier}
                onChange={(event) => setTier(event.target.value as "" | PlanTier)}
              >
                <option value="">{t("price.allPlans")}</option>
                <option value="PERSONAL">{t("price.personal")}</option>
                <option value="BUSINESS">{t("price.business")}</option>
              </Select>
            </Field>
            <Field label={t("price.cycle")} htmlFor="price-cycle">
              <Select
                id="price-cycle"
                value={cycle}
                onChange={(event) => setCycle(event.target.value as "" | BillingCycle)}
              >
                <option value="">{t("price.allCycles")}</option>
                <option value="MONTHLY">{t("price.monthly")}</option>
                <option value="YEARLY">{t("price.yearly")}</option>
              </Select>
            </Field>
          </div>
          {selectedCountry ? (
            <p className="text-xs text-ink-muted">
              {t("price.selectedLevel")}
              {": "}
              <span className="font-medium text-ink-secondary">
                {locale === "ar" ? selectedCountry.nameAr : selectedCountry.nameEn}
                {" ("}
                {selectedCountry.level}
                {")"}
              </span>
            </p>
          ) : null}
          <ul className="flex flex-col gap-1 text-xs text-ink-muted">
            <li>{t("price.baseNote")}</li>
            <li>{t("price.displayNote")}</li>
            <li>{t("price.noPayment")}</li>
          </ul>
        </Card>

        {error ? (
          <ErrorMessage error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : null}
        {busy ? <LoadingBlock label={t("price.loading")} /> : null}

        {catalog ? (
          visibleLevels.length === 0 ? (
            <EmptyState message={t("price.empty")} />
          ) : (
            visibleLevels.map((level) => {
              const plans = level.plans.filter((plan) => !tier || plan.tier === tier);
              return (
                <section key={level.level} aria-labelledby={`price-level-${level.level}`}>
                  <h2
                    id={`price-level-${level.level}`}
                    className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase"
                  >
                    {locale === "ar" ? level.nameAr : level.nameEn}
                  </h2>
                  {plans.length === 0 ? (
                    <EmptyState message={t("price.empty")} />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {plans.map((plan) => {
                        const prices = plan.prices.filter(
                          (price) => !cycle || price.billingCycle === cycle,
                        );
                        return (
                          <Card key={plan.tier} className="flex flex-col gap-3">
                            <h3 className="text-base font-semibold">
                              {locale === "ar" ? plan.nameAr : plan.nameEn}
                            </h3>
                            <ul className="flex flex-col gap-2">
                              {prices.map((price) => (
                                <li
                                  key={price.billingCycle}
                                  className="flex items-center justify-between gap-3 border-t border-line-subtle pt-2 first:border-0 first:pt-0"
                                >
                                  <span className="text-sm text-ink-muted">
                                    {t(CYCLE_LABEL_KEYS[price.billingCycle])}
                                  </span>
                                  <span
                                    className="hesab-numeric text-sm font-semibold"
                                    dir="ltr"
                                  >
                                    {price.baseAmount} {price.baseCurrency}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })
          )
        ) : null}

        <p className="text-xs text-ink-muted">{t("price.sampleNote")}</p>
      </div>
    </AppShell>
  );
}
