"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, EmptyState, ErrorMessage, LoadingBlock } from "@/components/Feedback";
import { Field, TextInput } from "@/components/Form";
import { KindBadge, StatusPill } from "@/components/StatusPill";
import { useLocale, useTranslations } from "@/components/LocaleProvider";
import { RequireSession } from "@/components/RequireSession";
import { useSession } from "@/components/SessionProvider";
import { useLedgerContext } from "@/hooks/useLedgerContext";
import {
  can,
  fetchReportAccounts,
  fetchReportBudgetComparison,
  fetchReportCategories,
  fetchReportProfitLoss,
  fetchReportSummary,
  fetchReportTimeseries,
  type ReportAccounts,
  type ReportBudgetComparison,
  type ReportCategories,
  type ReportProfitLoss,
  type ReportSummary,
  type ReportTimeseries,
} from "@/lib/api-client";
import { formatAmount, formatDate, todayIso } from "@/lib/format";
import type { MessageKey } from "@/lib/messages";

type PeriodPreset = "day" | "week" | "month";

type ReportData = {
  summary: ReportSummary;
  profitLoss: ReportProfitLoss;
  timeseries: ReportTimeseries;
  categories: ReportCategories;
  accounts: ReportAccounts;
  budgetComparison: ReportBudgetComparison;
};

type Loaded = { key: string; data: ReportData | null; error: unknown };

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function isoMonthStart(): string {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function requestKeyOf(
  token: string | null,
  ledgerId: string,
  from: string,
  to: string,
  reloadKey: number,
): string {
  return `${token ?? "anon"}:${ledgerId}:${from}:${to}:${reloadKey}`;
}

function budgetStatusLabel(
  status: ReportBudgetComparison["items"][number]["status"],
  t: (key: MessageKey) => string,
): string {
  if (status === "OVER") return t("bud.overBudget");
  if (status === "NEAR") return t("rpt.nearLimit");
  return t("bud.withinBudget");
}

function ReportsView({ ledgerId }: { ledgerId: string }) {
  const t = useTranslations();
  const { locale } = useLocale();
  const { token } = useSession();
  const { permissions, loading: contextLoading } = useLedgerContext(token, ledgerId);
  const canView = can(permissions, "reportView");

  const [from, setFrom] = useState<string>(isoMonthStart);
  const [to, setTo] = useState<string>(todayIso);
  const [range, setRange] = useState<{ from: string; to: string }>(() => ({
    from: isoMonthStart(),
    to: todayIso(),
  }));
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>({ key: "", data: null, error: null });

  const requestKey = requestKeyOf(token, ledgerId, range.from, range.to, reloadKey);
  const fresh = loaded.key === requestKey;
  const data = fresh ? loaded.data : null;
  const error = fresh ? loaded.error : null;
  const busy = !contextLoading && canView && !fresh;

  useEffect(() => {
    if (contextLoading || !canView) return;
    const controller = new AbortController();
    const { signal } = controller;
    const key = requestKeyOf(token, ledgerId, range.from, range.to, reloadKey);
    const query = { from: range.from, to: range.to };

    void (async () => {
      try {
        const [summary, profitLoss, timeseries, categories, accounts, budgetComparison] =
          await Promise.all([
            fetchReportSummary(token, ledgerId, query, signal),
            fetchReportProfitLoss(token, ledgerId, query, signal),
            fetchReportTimeseries(token, ledgerId, query, signal),
            fetchReportCategories(token, ledgerId, query, signal),
            fetchReportAccounts(token, ledgerId, query, signal),
            fetchReportBudgetComparison(token, ledgerId, query, signal),
          ]);
        if (signal.aborted) return;
        setLoaded({
          key,
          data: { summary, profitLoss, timeseries, categories, accounts, budgetComparison },
          error: null,
        });
      } catch (caught) {
        if (signal.aborted) return;
        setLoaded({ key, data: null, error: caught });
      }
    })();

    return () => controller.abort();
  }, [token, ledgerId, range.from, range.to, reloadKey, contextLoading, canView]);

  function retry() {
    setReloadKey((key) => key + 1);
  }

  function refresh() {
    setRange({ from, to });
    setReloadKey((key) => key + 1);
  }

  function applyPreset(preset: PeriodPreset) {
    const end = todayIso();
    const start = preset === "day" ? end : preset === "week" ? isoDaysAgo(6) : isoMonthStart();
    setFrom(start);
    setTo(end);
    setRange({ from: start, to: end });
  }

  return (
    <AppShell title={t("rpt.title")} ledgerHref="/ledgers">
      {contextLoading ? (
        <LoadingBlock label={t("nav.loading")} />
      ) : !canView ? (
        <EmptyState message={t("rpt.noPermission")} />
      ) : (
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("rpt.from")} htmlFor="rpt-from" required>
                <TextInput
                  id="rpt-from"
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </Field>
              <Field label={t("rpt.to")} htmlFor="rpt-to" required>
                <TextInput
                  id="rpt-to"
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => applyPreset("day")}>
                {t("rpt.presetDay")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => applyPreset("week")}
              >
                {t("rpt.presetWeek")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => applyPreset("month")}
              >
                {t("rpt.presetMonth")}
              </Button>
              <Button type="button" size="sm" onClick={refresh}>
                {t("rpt.load")}
              </Button>
            </div>
          </Card>

          {error ? <ErrorMessage error={error} onRetry={retry} /> : null}
          {busy ? <LoadingBlock label={t("rpt.loading")} /> : null}

          {data ? (
            <>
              <section aria-labelledby="rpt-summary-heading">
                <h2
                  id="rpt-summary-heading"
                  className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase"
                >
                  {t("rpt.summary")}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Card>
                    <p className="text-xs text-ink-muted">{t("rpt.totalIncome")}</p>
                    <p className="hesab-numeric text-xl font-semibold" dir="ltr">
                      {formatAmount(data.summary.totalIncome, locale)}
                    </p>
                  </Card>
                  <Card>
                    <p className="text-xs text-ink-muted">{t("rpt.totalExpense")}</p>
                    <p className="hesab-numeric text-xl font-semibold" dir="ltr">
                      {formatAmount(data.summary.totalExpense, locale)}
                    </p>
                  </Card>
                  <Card>
                    <p className="text-xs text-ink-muted">{t("rpt.net")}</p>
                    <p className="hesab-numeric text-xl font-semibold" dir="ltr">
                      {formatAmount(data.summary.net, locale)}
                    </p>
                  </Card>
                  <Card>
                    <p className="text-xs text-ink-muted">{t("rpt.count")}</p>
                    <p className="hesab-numeric text-xl font-semibold" dir="ltr">
                      {data.summary.count}
                    </p>
                  </Card>
                </div>
              </section>

              <section aria-labelledby="rpt-pnl-heading">
                <h2
                  id="rpt-pnl-heading"
                  className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase"
                >
                  {t("rpt.profitLoss")}
                </h2>
                <p className="mb-3 text-xs text-ink-muted">{data.profitLoss.resultLabel}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Card>
                    <p className="text-xs text-ink-muted">{t("rpt.totalSales")}</p>
                    <p className="hesab-numeric text-xl font-semibold" dir="ltr">
                      {formatAmount(data.profitLoss.totalSales, locale)}
                    </p>
                    <p className="hesab-numeric text-xs text-ink-muted" dir="ltr">
                      {data.profitLoss.salesCount}
                    </p>
                  </Card>
                  <Card>
                    <p className="text-xs text-ink-muted">{t("rpt.totalPurchases")}</p>
                    <p className="hesab-numeric text-xl font-semibold" dir="ltr">
                      {formatAmount(data.profitLoss.totalPurchases, locale)}
                    </p>
                    <p className="hesab-numeric text-xs text-ink-muted" dir="ltr">
                      {data.profitLoss.purchasesCount}
                    </p>
                  </Card>
                  <Card>
                    <p className="text-xs text-ink-muted">{t("rpt.operatingExpenses")}</p>
                    <p className="hesab-numeric text-xl font-semibold" dir="ltr">
                      {formatAmount(data.profitLoss.operatingExpenses, locale)}
                    </p>
                    <p className="hesab-numeric text-xs text-ink-muted" dir="ltr">
                      {data.profitLoss.expensesCount}
                    </p>
                  </Card>
                  <Card>
                    <p className="text-xs text-ink-muted">{t("rpt.netResult")}</p>
                    <p className="hesab-numeric text-xl font-semibold" dir="ltr">
                      {formatAmount(data.profitLoss.netResult, locale)}
                    </p>
                  </Card>
                </div>
                {data.profitLoss.otherIncomeCount > 0 ? (
                  <p className="mt-3 text-xs text-ink-muted">
                    {t("rpt.otherIncome")}:{" "}
                    <span className="hesab-numeric" dir="ltr">
                      {formatAmount(data.profitLoss.otherIncome, locale)}
                    </span>
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-ink-muted">{t("rpt.basedOnPosted")}</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-ink-muted">
                        <th scope="col" className="px-2 py-2 text-start font-medium">
                          {t("rpt.section")}
                        </th>
                        <th scope="col" className="px-2 py-2 text-start font-medium">
                          {t("rpt.cash")}
                        </th>
                        <th scope="col" className="px-2 py-2 text-start font-medium">
                          {t("rpt.credit")}
                        </th>
                        <th scope="col" className="px-2 py-2 text-start font-medium">
                          {t("rpt.total")}
                        </th>
                        <th scope="col" className="px-2 py-2 text-start font-medium">
                          {t("rpt.count")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.profitLoss.sections.map((section) => (
                        <tr key={section.key} className="border-t border-line-subtle">
                          <td className="px-2 py-2">{section.label}</td>
                          <td className="hesab-numeric px-2 py-2" dir="ltr">
                            {section.cash ? formatAmount(section.cash, locale) : t("common.none")}
                          </td>
                          <td className="hesab-numeric px-2 py-2" dir="ltr">
                            {section.credit ? formatAmount(section.credit, locale) : t("common.none")}
                          </td>
                          <td className="hesab-numeric px-2 py-2" dir="ltr">
                            {formatAmount(section.total, locale)}
                          </td>
                          <td className="hesab-numeric px-2 py-2" dir="ltr">
                            {section.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section aria-labelledby="rpt-timeseries-heading">
                <h2
                  id="rpt-timeseries-heading"
                  className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase"
                >
                  {t("rpt.timeseries")}
                </h2>
                {data.timeseries.items.length === 0 ? (
                  <EmptyState message={t("rpt.noData")} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-ink-muted">
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("rpt.period")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("txn.income")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("txn.expense")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("rpt.net")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("rpt.count")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.timeseries.items.map((item) => (
                          <tr key={item.period} className="border-t border-line-subtle">
                            <td className="px-2 py-2" dir="ltr">
                              {formatDate(item.period, locale)}
                            </td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {formatAmount(item.income, locale)}
                            </td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {formatAmount(item.expense, locale)}
                            </td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {formatAmount(item.net, locale)}
                            </td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {item.count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section aria-labelledby="rpt-categories-heading">
                <h2
                  id="rpt-categories-heading"
                  className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase"
                >
                  {t("rpt.categories")}
                </h2>
                {data.categories.items.length === 0 ? (
                  <EmptyState message={t("rpt.noData")} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-ink-muted">
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("txn.category")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("txn.item")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("txn.income")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("txn.expense")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("rpt.net")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("rpt.count")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.categories.items.map((item, index) => (
                          <tr
                            key={`${item.categoryId ?? "none"}:${item.categoryItemId ?? ""}:${index}`}
                            className="border-t border-line-subtle"
                          >
                            <td className="px-2 py-2">{item.categoryName ?? t("common.none")}</td>
                            <td className="px-2 py-2">{item.categoryItemName ?? t("common.none")}</td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {formatAmount(item.income, locale)}
                            </td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {formatAmount(item.expense, locale)}
                            </td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {formatAmount(item.net, locale)}
                            </td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {item.count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section aria-labelledby="rpt-accounts-heading">
                <h2
                  id="rpt-accounts-heading"
                  className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase"
                >
                  {t("rpt.accounts")}
                </h2>
                {data.accounts.items.length === 0 ? (
                  <EmptyState message={t("rpt.noData")} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-ink-muted">
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("txn.account")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("rpt.currency")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("txn.income")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("txn.expense")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("rpt.net")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("rpt.count")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.accounts.items.map((item, index) => (
                          <tr
                            key={`${item.accountId ?? "none"}:${index}`}
                            className="border-t border-line-subtle"
                          >
                            <td className="px-2 py-2">{item.accountName ?? t("common.none")}</td>
                            <td className="px-2 py-2" dir="ltr">
                              {item.currencyCode ?? t("common.none")}
                            </td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {formatAmount(item.income, locale)}
                            </td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {formatAmount(item.expense, locale)}
                            </td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {formatAmount(item.net, locale)}
                            </td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {item.count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {data.budgetComparison.items.length > 0 ? (
                <section aria-labelledby="rpt-budget-heading">
                  <h2
                    id="rpt-budget-heading"
                    className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase"
                  >
                    {t("rpt.budgetComparison")}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-ink-muted">
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("rpt.budget")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("bud.limit")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("rpt.executed")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("bud.remaining")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("bud.percentUsed")}
                          </th>
                          <th scope="col" className="px-2 py-2 text-start font-medium">
                            {t("rpt.status")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.budgetComparison.items.map((item) => (
                          <tr key={item.budgetId} className="border-t border-line-subtle">
                            <td className="px-2 py-2">
                              <span className="flex flex-wrap items-center gap-2">
                                <KindBadge
                                  kind={item.flow}
                                  label={item.flow === "INCOME" ? t("txn.income") : t("txn.expense")}
                                />
                                {item.budgetName}
                              </span>
                            </td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {formatAmount(item.limit, locale)}
                            </td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {formatAmount(item.executed, locale)}
                            </td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {formatAmount(item.remaining, locale)}
                            </td>
                            <td className="hesab-numeric px-2 py-2" dir="ltr">
                              {formatAmount(item.percentUsed, locale)}%
                            </td>
                            <td className="px-2 py-2">
                              <StatusPill
                                tone={
                                  item.status === "OVER"
                                    ? "expense"
                                    : item.status === "NEAR"
                                      ? "warning"
                                      : "income"
                                }
                              >
                                {budgetStatusLabel(item.status, t)}
                              </StatusPill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

export default function ReportsPage() {
  const params = useParams<{ ledgerId: string }>();
  return (
    <RequireSession>
      <ReportsView ledgerId={params.ledgerId} />
    </RequireSession>
  );
}
