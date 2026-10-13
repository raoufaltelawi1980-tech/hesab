"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, EmptyState, ErrorMessage, LoadingBlock } from "@/components/Feedback";
import { Field, Select, TextInput } from "@/components/Form";
import { KindBadge, StatusPill } from "@/components/StatusPill";
import { useLocale, useTranslations } from "@/components/LocaleProvider";
import { useSession } from "@/components/SessionProvider";
import { useLedgerContext } from "@/hooks/useLedgerContext";
import {
  addBudgetPeriod,
  archiveBudget,
  acknowledgeBudgetAlertEvent,
  can,
  createBudget,
  fetchBudgetAlertEvents,
  fetchBudgetPeriods,
  fetchBudgetProgress,
  fetchBudgets,
  type Budget,
  type BudgetAlertEvent,
  type BudgetFlow,
  type BudgetLimitType,
  type BudgetPercentBasis,
  type BudgetPeriod,
  type BudgetPeriodType,
  type BudgetProgress,
} from "@/lib/api-client";
import { formatAmount, formatDate } from "@/lib/format";
import { todayIso } from "@/lib/format";
import type { MessageKey } from "@/lib/messages";
import {
  buildBudgetInput,
  flowLabel,
  limitSummary,
  limitTypeLabel,
  periodTypeLabel,
  progressFill,
  progressTone,
} from "./budget-labels";

const FLOWS: BudgetFlow[] = ["EXPENSE", "INCOME"];
const PERIOD_TYPES: BudgetPeriodType[] = ["MONTHLY", "WEEKLY", "DAILY", "YEARLY", "CUSTOM"];
const LIMIT_TYPES: BudgetLimitType[] = ["FIXED_AMOUNT", "PERCENTAGE"];
const BASES: BudgetPercentBasis[] = ["OF_TOTAL_EXPENSE", "OF_TOTAL_INCOME"];

type FormState = {
  name: string;
  flow: BudgetFlow;
  periodType: BudgetPeriodType;
  limitType: BudgetLimitType;
  amount: string;
  percentBasis: BudgetPercentBasis;
  categoryId: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  flow: "EXPENSE",
  periodType: "MONTHLY",
  limitType: "FIXED_AMOUNT",
  amount: "",
  percentBasis: "OF_TOTAL_EXPENSE",
  categoryId: "",
};

export function BudgetsView({ ledgerId }: { ledgerId: string }) {
  const t = useTranslations();
  const { locale } = useLocale();
  const { token } = useSession();
  const { permissions, categories } = useLedgerContext(token, ledgerId);
  const canManage = can(permissions, "budgetManage");

  const [reloadKey, setReloadKey] = useState(0);
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [listError, setListError] = useState<unknown>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * Keyed by budget id so a slow response for the previous selection can never
   * be painted against the budget the user is looking at now.
   */
  const [progressState, setProgressState] = useState<{
    budgetId: string;
    progress: BudgetProgress;
    periods: BudgetPeriod[];
  } | null>(null);
  const [progressError, setProgressError] = useState<unknown>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [periodStart, setPeriodStart] = useState(todayIso());
  const [periodEnd, setPeriodEnd] = useState(todayIso());
  const [periodError, setPeriodError] = useState<unknown>(null);
  const [periodBusy, setPeriodBusy] = useState(false);

  /**
   * The alert feed is ledger-wide (§10.2 has no per-budget query), so it is
   * loaded once and narrowed to the selected budget by matching period ids.
   */
  const [events, setEvents] = useState<BudgetAlertEvent[] | null>(null);
  const [alertsError, setAlertsError] = useState<unknown>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      try {
        const rows = await fetchBudgets(token, ledgerId, signal);
        if (signal.aborted) return;
        setBudgets(rows);
        setListError(null);
        setSelectedId((current) => current ?? rows[0]?.id ?? null);
      } catch (caught) {
        if (signal.aborted) return;
        setBudgets([]);
        setListError(caught);
      }
    })();
    return () => controller.abort();
  }, [token, ledgerId, reloadKey]);

  const selected = budgets?.find((row) => row.id === selectedId) ?? null;
  const shown =
    progressState && progressState.budgetId === selectedId
      ? { progress: progressState.progress, periods: progressState.periods }
      : { progress: null, periods: [] as BudgetPeriod[] };
  const alerts =
    events === null || shown.periods.length === 0
      ? []
      : events.filter((event) => shown.periods.some((period) => period.id === event.budgetPeriodId));

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      try {
        setEvents(await fetchBudgetAlertEvents(token, ledgerId, signal));
        setAlertsError(null);
      } catch (caught) {
        if (signal.aborted) return;
        setEvents([]);
        setAlertsError(caught);
      }
    })();
    return () => controller.abort();
  }, [token, ledgerId, reloadKey]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      try {
        const [nextProgress, nextPeriods] = await Promise.all([
          fetchBudgetProgress(token, ledgerId, selectedId, signal),
          fetchBudgetPeriods(token, ledgerId, selectedId, signal),
        ]);
        if (signal.aborted) return;
        setProgressState({ budgetId: selectedId, progress: nextProgress, periods: nextPeriods });
        setProgressError(null);
      } catch (caught) {
        if (signal.aborted) return;
        setProgressState(null);
        setProgressError(caught);
      }
    })();
    return () => controller.abort();
  }, [token, ledgerId, selectedId, reloadKey]);

  function retry() {
    setListError(null);
    setReloadKey((key) => key + 1);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setNotice(null);
    try {
      const created = await createBudget(token, ledgerId, buildBudgetInput(form));
      setBudgets((rows) => [...(rows ?? []), created]);
      setSelectedId(created.id);
      setForm(EMPTY_FORM);
      setNotice(t("bud.created"));
    } catch (caught) {
      setFormError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(budgetId: string) {
    setListError(null);
    try {
      await archiveBudget(token, ledgerId, budgetId);
      setBudgets((rows) => (rows ?? []).filter((row) => row.id !== budgetId));
      if (selectedId === budgetId) setSelectedId(null);
      setNotice(t("bud.archived"));
    } catch (caught) {
      setListError(caught);
    }
  }

  async function handleAddPeriod(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    setPeriodBusy(true);
    setPeriodError(null);
    try {
      await addBudgetPeriod(token, ledgerId, selectedId, { periodStart, periodEnd });
      setNotice(t("bud.periodAdded"));
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setPeriodError(caught);
    } finally {
      setPeriodBusy(false);
    }
  }

  async function handleAcknowledge(eventId: string) {
    setAlertsError(null);
    try {
      await acknowledgeBudgetAlertEvent(token, ledgerId, eventId);
      const acknowledgedAt = new Date().toISOString();
      setEvents((rows) =>
        rows?.map((row) =>
          row.id === eventId ? { ...row, status: "ACKNOWLEDGED", acknowledgedAt } : row,
        ) ?? null,
      );
      setNotice(t("bud.alertAcknowledged"));
    } catch (caught) {
      setAlertsError(caught);
    }
  }

  const busy = budgets === null;
  /*
   * `Category` carries no `isBudgetable` on the wire, so the form offers every
   * category and `BudgetsService.validateScope` stays the single authority that
   * rejects a non-budgetable one.
   */
  const scopedCategories = categories.filter((category) => category.id);

  return (
    <AppShell
      title={t("bud.title")}
      subtitle={t("bud.subtitle")}
      ledgerHref="/ledgers"
      actions={
        <Link href={`/ledgers/${ledgerId}/transactions`}>
          <Button variant="secondary" size="sm">
            {t("bud.viewTransactions")}
          </Button>
        </Link>
      }
    >
      <div className="flex flex-col gap-6">
        {listError ? <ErrorMessage error={listError} onRetry={retry} /> : null}
        {notice ? (
          <p role="status" className="rounded-lg border border-line-subtle bg-surface-raised px-4 py-2 text-sm text-ink-secondary">
            {notice}
          </p>
        ) : null}
        {busy ? <LoadingBlock label={t("nav.loading")} /> : null}

        {!busy ? (
          <section aria-labelledby="bud-list-heading">
            <h2 id="bud-list-heading" className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase">
              {t("bud.listHeading")}
            </h2>
            {budgets.length === 0 ? (
              <EmptyState message={t("bud.empty")} />
            ) : (
              <ul className="flex flex-col gap-3">
                {budgets.map((budget) => {
                  const isSelected = budget.id === selectedId;
                  return (
                    <li key={budget.id}>
                      <Card
                        className={`flex flex-wrap items-center justify-between gap-4 ${
                          isSelected ? "border-accent" : ""
                        }`}
                      >
                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <KindBadge
                              kind={budget.flow}
                              label={flowLabel(t, budget.flow)}
                            />
                            <StatusPill tone="neutral">{periodTypeLabel(t, budget.periodType)}</StatusPill>
                            {budget.archivedAt ? (
                              <StatusPill tone="expense">{t("bud.archivedBadge")}</StatusPill>
                            ) : null}
                          </div>
                          <p className="truncate text-base font-semibold">{budget.name}</p>
                          <p className="truncate text-xs text-ink-muted">
                            {limitTypeLabel(t, budget.limitType)} ·{" "}
                            {limitSummary(t, budget, (value) => formatAmount(value, locale))}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedId(budget.id)}
                            aria-pressed={isSelected}
                          >
                            {t("bud.progressHeading")}
                          </Button>
                          {canManage ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleArchive(budget.id)}
                            >
                              {t("bud.archive")}
                            </Button>
                          ) : null}
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        {!busy && selected ? (
          <section aria-labelledby="bud-progress-heading">
            <h2 id="bud-progress-heading" className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase">
              {t("bud.progressHeading")}
            </h2>
            {progressError ? (
              <ErrorMessage error={progressError} onRetry={() => setReloadKey((key) => key + 1)} />
            ) : null}
            {!progressError && !shown.progress ? (
              <EmptyState message={t("bud.noPeriod")} />
            ) : null}
            {shown.progress ? (
              <Card className="flex flex-col gap-4">
                <div
                  role="progressbar"
                  aria-label={t("bud.percentUsed")}
                  aria-valuenow={Number(shown.progress.percentUsed)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
                >
                  <div
                    className={`h-full ${progressTone(shown.progress)}`}
                    style={{ width: `${progressFill(shown.progress)}%` }}
                  />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-ink-muted">{t("bud.spent")}</dt>
                    <dd className="hesab-numeric font-semibold" dir="ltr">
                      {formatAmount(shown.progress.amountSpent, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">{t("bud.limit")}</dt>
                    <dd className="hesab-numeric font-semibold" dir="ltr">
                      {formatAmount(shown.progress.limit, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">{t("bud.remaining")}</dt>
                    <dd className="hesab-numeric font-semibold" dir="ltr">
                      {formatAmount(shown.progress.remaining, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">{t("bud.percentUsed")}</dt>
                    <dd className="hesab-numeric font-semibold" dir="ltr">
                      {formatAmount(shown.progress.percentUsed, locale)}%
                    </dd>
                  </div>
                </dl>
                <p>
                  <StatusPill tone={shown.progress.isOverBudget ? "expense" : "income"}>
                    {shown.progress.isOverBudget ? t("bud.overBudget") : t("bud.withinBudget")}
                  </StatusPill>
                </p>
                {shown.progress.period ? (
                  <p className="text-xs text-ink-muted" dir="ltr">
                    {formatDate(shown.progress.period.periodStart, locale)} →{" "}
                    {formatDate(shown.progress.period.periodEnd, locale)}
                  </p>
                ) : null}
              </Card>
            ) : null}

            <h3 className="mt-6 mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase">
              {t("bud.periodsHeading")}
            </h3>
            {shown.periods.length === 0 ? (
              <EmptyState message={t("bud.noPeriod")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {shown.periods.map((period) => (
                  <li
                    key={period.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-subtle bg-surface-raised px-4 py-3 text-sm"
                  >
                    <span className="hesab-numeric" dir="ltr">
                      {formatDate(period.periodStart, locale)} → {formatDate(period.periodEnd, locale)}
                    </span>
                    <span className="hesab-numeric" dir="ltr">
                      {formatAmount(period.amountSpent, locale)} / {formatAmount(period.effectiveLimit, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {canManage ? (
              <form className="mt-4 flex flex-col gap-3" onSubmit={handleAddPeriod}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("bud.periodStart")} htmlFor="bud-period-start" required>
                    <TextInput
                      id="bud-period-start"
                      type="date"
                      required
                      value={periodStart}
                      onChange={(event) => setPeriodStart(event.target.value)}
                    />
                  </Field>
                  <Field label={t("bud.periodEnd")} htmlFor="bud-period-end" required>
                    <TextInput
                      id="bud-period-end"
                      type="date"
                      required
                      value={periodEnd}
                      onChange={(event) => setPeriodEnd(event.target.value)}
                    />
                  </Field>
                </div>
                {periodError ? <ErrorMessage error={periodError} /> : null}
                <div>
                  <Button type="submit" size="sm" disabled={periodBusy}>
                    {periodBusy ? t("bud.addingPeriod") : t("bud.addPeriod")}
                  </Button>
                </div>
              </form>
            ) : null}

            <h3 className="mt-6 mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase">
              {t("bud.alertsHeading")}
            </h3>
            {alertsError ? <ErrorMessage error={alertsError} /> : null}
            {!alertsError && alerts.length === 0 ? (
              <EmptyState message={t("bud.alertsEmpty")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {alerts.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-subtle bg-surface-raised px-4 py-3 text-sm"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="hesab-numeric" dir="ltr">
                        {t("bud.observed")}: {formatAmount(event.observedAmount, locale)} ·{" "}
                        {t("bud.threshold")}: {formatAmount(event.thresholdAmount, locale)}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {formatDate(event.triggeredAt, locale)}
                      </span>
                    </div>
                    {event.status === "TRIGGERED" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleAcknowledge(event.id)}
                      >
                        {t("bud.acknowledge")}
                      </Button>
                    ) : (
                      <StatusPill tone="neutral">{t("bud.acknowledged")}</StatusPill>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {!busy && budgets.length === 0 ? (
          <p className="text-xs text-ink-muted">{t("bud.selectHint")}</p>
        ) : null}

        {canManage ? (
          <section aria-labelledby="bud-new-heading">
            <h2 id="bud-new-heading" className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase">
              {t("bud.newHeading")}
            </h2>
            <Card>
              <form className="flex flex-col gap-4" onSubmit={handleCreate}>
                <Field label={t("bud.name")} htmlFor="bud-name" required>
                  <TextInput
                    id="bud-name"
                    required
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label={t("bud.flow")} htmlFor="bud-flow">
                    <Select
                      id="bud-flow"
                      value={form.flow}
                      onChange={(event) => setForm({ ...form, flow: event.target.value as BudgetFlow })}
                    >
                      {FLOWS.map((flow) => (
                        <option key={flow} value={flow}>
                          {flowLabel(t, flow)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("bud.periodType")} htmlFor="bud-period-type">
                    <Select
                      id="bud-period-type"
                      value={form.periodType}
                      onChange={(event) =>
                        setForm({ ...form, periodType: event.target.value as BudgetPeriodType })
                      }
                    >
                      {PERIOD_TYPES.map((periodType) => (
                        <option key={periodType} value={periodType}>
                          {periodTypeLabel(t, periodType)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("bud.limitType")} htmlFor="bud-limit-type">
                    <Select
                      id="bud-limit-type"
                      value={form.limitType}
                      onChange={(event) =>
                        setForm({ ...form, limitType: event.target.value as BudgetLimitType })
                      }
                    >
                      {LIMIT_TYPES.map((limitType) => (
                        <option key={limitType} value={limitType}>
                          {limitTypeLabel(t, limitType)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label={
                      form.limitType === "FIXED_AMOUNT" ? t("bud.fixedAmount") : t("bud.percentValue")
                    }
                    htmlFor="bud-amount"
                    required
                  >
                    <TextInput
                      id="bud-amount"
                      required
                      inputMode="decimal"
                      value={form.amount}
                      onChange={(event) => setForm({ ...form, amount: event.target.value })}
                    />
                  </Field>
                  {form.limitType === "PERCENTAGE" ? (
                    <Field label={t("bud.percentBasis")} htmlFor="bud-basis">
                      <Select
                        id="bud-basis"
                        value={form.percentBasis}
                        onChange={(event) =>
                          setForm({ ...form, percentBasis: event.target.value as BudgetPercentBasis })
                        }
                      >
                        {BASES.map((basis) => (
                          <option key={basis} value={basis}>
                            {t(`bud.basis.${basis === "OF_TOTAL_INCOME" ? "income" : "expense"}` as MessageKey)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : (
                    <Field label={t("bud.category")} htmlFor="bud-category" hint={t("common.optional")}>
                      <Select
                        id="bud-category"
                        value={form.categoryId}
                        onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                      >
                        <option value="">{t("bud.categoryAny")}</option>
                        {scopedCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                </div>

                {scopedCategories.length === 0 ? (
                  <p className="text-xs text-ink-muted">{t("bud.noBudgetableCategories")}</p>
                ) : null}
                {formError ? <ErrorMessage error={formError} /> : null}
                <div>
                  <Button type="submit" size="sm" disabled={submitting}>
                    {submitting ? t("bud.creating") : t("bud.create")}
                  </Button>
                </div>
              </form>
            </Card>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}