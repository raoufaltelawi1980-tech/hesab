"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, EmptyState, ErrorMessage, LoadingBlock } from "@/components/Feedback";
import { Field, Select, TextInput } from "@/components/Form";
import { StatusPill } from "@/components/StatusPill";
import { useLocale, useTranslations } from "@/components/LocaleProvider";
import { useSession } from "@/components/SessionProvider";
import {
  createLedger,
  fetchReferenceCountries,
  fetchReferenceCurrencies,
  type LedgerSummary,
  type ReferenceCountry,
  type ReferenceCurrency,
} from "@/lib/api-client";

type ReferenceState = {
  countries: ReferenceCountry[] | null;
  currencies: ReferenceCurrency[] | null;
  error: unknown;
};

/**
 * شاشة إنشاء دفتر (الدورة الأولى). النوع ثابت `HOUSEHOLD` ولا يمكن إنشاء
 * `BUSINESS` من هنا؛ الدول والعملات تُحمَّل من المرجع العام (`/reference/*`)
 * لا من قوائم ثابتة.
 */
export function NewLedgerView() {
  const t = useTranslations();
  const { locale } = useLocale();
  const { token } = useSession();
  const router = useRouter();

  const [reloadKey, setReloadKey] = useState(0);
  const [reference, setReference] = useState<ReferenceState>({
    countries: null,
    currencies: null,
    error: null,
  });
  const { countries, currencies, error: referenceError } = reference;

  const [name, setName] = useState("");
  const [countryId, setCountryId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const [created, setCreated] = useState<LedgerSummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      try {
        const [nextCountries, nextCurrencies] = await Promise.all([
          fetchReferenceCountries(signal),
          fetchReferenceCurrencies(signal),
        ]);
        if (signal.aborted) return;
        setReference({ countries: nextCountries, currencies: nextCurrencies, error: null });
      } catch (caught) {
        if (signal.aborted) return;
        setReference({ countries: [], currencies: [], error: caught });
      }
    })();
    return () => controller.abort();
  }, [reloadKey]);

  function retry() {
    setReference({ countries: null, currencies: null, error: null });
    setReloadKey((key) => key + 1);
  }

  const trimmedName = name.trim();
  const nameError =
    touched && trimmedName.length === 0 ? t("newLedger.nameRequired") : undefined;
  const countryError =
    touched && countryId.length === 0 ? t("newLedger.countryRequired") : undefined;
  const currencyError =
    touched && currencyId.length === 0 ? t("newLedger.currencyRequired") : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    setFormError(null);
    if (trimmedName.length === 0 || countryId.length === 0 || currencyId.length === 0) return;

    setSubmitting(true);
    try {
      const ledger = await createLedger(token, {
        name: trimmedName,
        type: "HOUSEHOLD",
        countryId,
        baseCurrencyId: currencyId,
      });
      setCreated(ledger);
      router.replace(`/ledgers/${ledger.id}/transactions`);
    } catch (caught) {
      setFormError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  const loading = countries === null || currencies === null;
  const referenceEmpty =
    !referenceError &&
    countries !== null &&
    currencies !== null &&
    (countries.length === 0 || currencies.length === 0);

  function countryLabel(country: ReferenceCountry) {
    return locale === "ar" ? country.nameAr : country.nameEn;
  }
  function currencyLabel(currency: ReferenceCurrency) {
    return `${currency.code} · ${locale === "ar" ? currency.nameAr : currency.nameEn}`;
  }

  return (
    <AppShell title={t("newLedger.title")} subtitle={t("newLedger.subtitle")} ledgerHref="/ledgers">
      <div className="flex flex-col gap-6">
        {created ? (
          <p
            role="status"
            className="rounded-lg border border-line-subtle bg-surface-raised px-4 py-2 text-sm text-ink-secondary"
          >
            {t("newLedger.created")}
          </p>
        ) : null}

        {referenceError ? <ErrorMessage error={referenceError} onRetry={retry} /> : null}
        {loading && !referenceError ? <LoadingBlock label={t("nav.loading")} /> : null}
        {referenceEmpty ? <EmptyState message={t("newLedger.referenceEmpty")} /> : null}

        {countries !== null &&
        currencies !== null &&
        !referenceError &&
        countries.length > 0 &&
        currencies.length > 0 ? (
          <Card>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
              <Field label={t("newLedger.name")} htmlFor="new-ledger-name" required error={nameError}>
                <TextInput
                  id="new-ledger-name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink-secondary">{t("newLedger.type")}</span>
                <span>
                  <StatusPill tone="info">{t("ledger.type.household")}</StatusPill>
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t("newLedger.country")}
                  htmlFor="new-ledger-country"
                  required
                  error={countryError}
                >
                  <Select
                    id="new-ledger-country"
                    required
                    value={countryId}
                    onChange={(event) => setCountryId(event.target.value)}
                  >
                    <option value="">{t("newLedger.selectCountry")}</option>
                    {countries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {countryLabel(country)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label={t("newLedger.currency")}
                  htmlFor="new-ledger-currency"
                  required
                  error={currencyError}
                >
                  <Select
                    id="new-ledger-currency"
                    required
                    value={currencyId}
                    onChange={(event) => setCurrencyId(event.target.value)}
                  >
                    <option value="">{t("newLedger.selectCurrency")}</option>
                    {currencies.map((currency) => (
                      <option key={currency.id} value={currency.id}>
                        {currencyLabel(currency)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {formError ? <ErrorMessage error={formError} /> : null}

              <div>
                <Button type="submit" loading={submitting}>
                  {submitting ? t("newLedger.submitting") : t("newLedger.submit")}
                </Button>
              </div>
            </form>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
