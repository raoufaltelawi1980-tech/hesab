"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, ErrorMessage, LoadingBlock } from "@/components/Feedback";
import { Field, Select, TextArea, TextInput } from "@/components/Form";
import { useTranslations } from "@/components/LocaleProvider";
import { useSession } from "@/components/SessionProvider";
import { can, createDraft, type CreateDraftInput } from "@/lib/api-client";
import { todayIso } from "@/lib/format";
import { selectableItems, useLedgerContext } from "@/hooks/useLedgerContext";

export function NewTransactionView({ ledgerId }: { ledgerId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { token } = useSession();
  const { accounts, categories, ledger, permissions, loading, error, reload } = useLedgerContext(
    token,
    ledgerId,
  );

  const [type, setType] = useState<CreateDraftInput["type"]>("EXPENSE");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryItemId, setCategoryItemId] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [description, setDescription] = useState("");
  const [businessDate, setBusinessDate] = useState(todayIso);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const mayCreate = can(permissions, "create");

  /** Currency codes come from the ledger's own accounts and base currency. */
  const currencyOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const account of accounts) if (account.currency?.code) codes.add(account.currency.code);
    if (ledger?.baseCurrency?.code) codes.add(ledger.baseCurrency.code);
    return [...codes].sort();
  }, [accounts, ledger]);

const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const availableItems = useMemo(() => selectableItems(selectedCategory), [selectedCategory]);

  // Derived rather than synchronised in an effect: an untouched currency falls back to the
  // ledger's first one, and a sub-item left over from another category simply stops being offered.
  const currencyValue = currencyCode !== "" ? currencyCode : (currencyOptions[0] ?? "");
  const categoryItemValue = availableItems.some((item) => item.id === categoryItemId)
    ? categoryItemId
    : "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const payload: CreateDraftInput = {
      type,
      financialAccountId: accountId,
      categoryId,
      amount: amount.trim(),
      currencyCode: currencyValue,
      businessDate,
    };
    if (categoryItemValue) payload.categoryItemId = categoryItemValue;
    if (description.trim()) payload.description = description.trim();
    if (exchangeRate.trim()) payload.exchangeRate = exchangeRate.trim();

    setSubmitting(true);
    try {
      const result = await createDraft(token, ledgerId, payload);
      router.push(`/ledgers/${ledgerId}/transactions/${result.draft.id}`);
    } catch (caught) {
      setSubmitError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AppShell title={t("txn.newTitle")} ledgerHref="/ledgers">
        <LoadingBlock label={t("nav.loading")} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t("txn.newTitle")}
      ledgerHref={`/ledgers/${ledgerId}/transactions`}
      actions={
        <Link href={`/ledgers/${ledgerId}/transactions`}>
          <Button variant="secondary" size="sm">
            {t("common.back")}
          </Button>
        </Link>
      }
    >
      {error ? <ErrorMessage error={error} onRetry={reload} /> : null}

      {!mayCreate ? (
        <Card className="mb-4 border-warning/40 bg-warning-soft">
          <p className="text-sm text-warning-ink">{t("perm.noCreate")}</p>
        </Card>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Card>
          <fieldset>
            <legend className="mb-3 text-sm font-medium text-ink-secondary">{t("txn.type")}</legend>
            <div className="flex gap-3">
              {(["EXPENSE", "INCOME"] as const).map((option) => {
                const label = option === "INCOME" ? t("txn.income") : t("txn.expense");
                const active = type === option;
                return (
                  <label
                    key={option}
                    className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      active
                        ? option === "INCOME"
                          ? "border-income bg-income-soft text-income-ink"
                          : "border-expense bg-expense-soft text-expense-ink"
                        : "border-line-strong text-ink-secondary hover:border-accent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={option}
                      checked={active}
                      onChange={() => setType(option)}
                      className="sr-only"
                    />
                    <span aria-hidden="true">{option === "INCOME" ? "▲" : "▼"}</span>
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Card>

        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("txn.amount")} htmlFor="amount" required>
              <TextInput
                id="amount"
                name="amount"
                inputMode="decimal"
                dir="ltr"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>

            <Field label={t("txn.currency")} htmlFor="currencyCode" required>
              <Select
                id="currencyCode"
                name="currencyCode"
                dir="ltr"
                required
                value={currencyValue}
                onChange={(e) => setCurrencyCode(e.target.value)}
              >
                {currencyOptions.length === 0 ? <option value="">—</option> : null}
                {currencyOptions.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t("txn.exchangeRate")}
              htmlFor="exchangeRate"
              hint={t("txn.exchangeHint")}
            >
              <TextInput
                id="exchangeRate"
                name="exchangeRate"
                inputMode="decimal"
                dir="ltr"
                placeholder="1"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
              />
            </Field>

            <Field label={t("txn.date")} htmlFor="businessDate" required>
              <TextInput
                id="businessDate"
                name="businessDate"
                type="date"
                dir="ltr"
                required
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("txn.account")} htmlFor="financialAccountId" required>
              <Select
                id="financialAccountId"
                name="financialAccountId"
                required
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={accounts.length === 0}
              >
                <option value="">—</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t("txn.category")} htmlFor="categoryId" required>
              <Select
                id="categoryId"
                name="categoryId"
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={categories.length === 0}
              >
                <option value="">—</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t("txn.item")} htmlFor="categoryItemId">
              <Select
                id="categoryItemId"
                name="categoryItemId"
                value={categoryItemValue}
                onChange={(e) => setCategoryItemId(e.target.value)}
                disabled={!selectedCategory || availableItems.length === 0}
              >
                <option value="">{t("common.none")}</option>
                {availableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t("txn.description")} htmlFor="description">
              <TextArea
                id="description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </div>

          {accounts.length === 0 ? (
            <p className="mt-4 text-xs text-warning-ink">{t("txn.noAccounts")}</p>
          ) : null}
          {categories.length === 0 ? (
            <p className="mt-4 text-xs text-warning-ink">{t("txn.noCategories")}</p>
          ) : null}
        </Card>

        {submitError ? <ErrorMessage error={submitError} /> : null}

        <div className="flex justify-end gap-2">
          <Link href={`/ledgers/${ledgerId}/transactions`}>
            <Button variant="ghost" type="button">
              {t("common.cancel")}
            </Button>
          </Link>
          <Button type="submit" loading={submitting} disabled={!mayCreate}>
            {submitting ? t("txn.creating") : t("txn.create")}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}