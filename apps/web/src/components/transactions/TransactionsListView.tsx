"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, EmptyState, ErrorMessage, LoadingBlock } from "@/components/Feedback";
import { KindBadge, StatusPill } from "@/components/StatusPill";
import { VoiceTransactionView } from "@/components/transactions/VoiceTransactionView";
import { useLocale, useTranslations } from "@/components/LocaleProvider";
import { useSession } from "@/components/SessionProvider";
import {
  can,
  fetchDrafts,
  fetchPostedEntries,
  type DraftStatus,
  type DraftSummary,
  type PostedEntry,
} from "@/lib/api-client";
import { formatAmount, formatDate } from "@/lib/format";
import { useLedgerContext } from "@/hooks/useLedgerContext";
import type { MessageKey } from "@/lib/messages";

const statusTone: Record<DraftStatus, "neutral" | "info" | "warning" | "income" | "expense"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  CONFIRMED: "warning",
  POSTED: "income",
  REJECTED: "expense",
};

export function TransactionsListView({ ledgerId }: { ledgerId: string }) {
  const t = useTranslations();
  const { locale } = useLocale();
  const { token } = useSession();
  const { ledger, permissions } = useLedgerContext(token, ledgerId);

  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<{
    drafts: DraftSummary[] | null;
    posted: PostedEntry[] | null;
    error: unknown;
  }>({ drafts: null, posted: null, error: null });

  const { drafts, posted, error } = state;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    void (async () => {
      try {
        const [nextDrafts, nextPosted] = await Promise.all([
          fetchDrafts(token, ledgerId, signal),
          fetchPostedEntries(token, ledgerId, signal),
        ]);
        if (signal.aborted) return;
        setState({ drafts: nextDrafts, posted: nextPosted, error: null });
      } catch (caught) {
        if (signal.aborted) return;
        setState({ drafts: [], posted: [], error: caught });
      }
    })();

    return () => controller.abort();
  }, [token, ledgerId, reloadKey]);

  const busy = drafts === null || posted === null;
  const mayCreate = can(permissions, "create");
  /** §5/§6 of the first cycle: budgets and family reports belong to `HOUSEHOLD` ledgers only. */
  const isHousehold = ledger?.type === "HOUSEHOLD";

  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);

  function retry() {
    setState((prev) => ({ ...prev, error: null }));
    setReloadKey((k) => k + 1);
  }

  function handleDraftCreated(draftId: string) {
    setCreatedDraftId(draftId);
    setReloadKey((k) => k + 1);
  }

  return (
    <AppShell
      title={t("txn.listTitle")}
      subtitle={t("txn.listSubtitle")}
      ledgerHref="/ledgers"
      actions={
        isHousehold ? (
          <>
            <Link href={`/ledgers/${ledgerId}/budgets`}>
              <Button variant="secondary" size="sm">
                {t("bud.title")}
              </Button>
            </Link>
            <Link href={`/ledgers/${ledgerId}/reports`}>
              <Button variant="secondary" size="sm">
                {t("rpt.title")}
              </Button>
            </Link>
          </>
        ) : undefined
      }
    >
      {!mayCreate && permissions !== null ? (
        <Card className="mb-6 border-warning/40 bg-warning-soft">
          <p className="text-sm text-warning-ink">{t("ledger.voiceUnavailable")}</p>
        </Card>
      ) : null}

      {mayCreate ? (
        <section className="mb-6">
          <h2 className="mb-1 text-lg font-semibold tracking-tight">{t("ledger.voiceEntry")}</h2>
          <p className="mb-3 text-sm text-ink-muted">{t("ledger.voiceEntryDescription")}</p>

          {createdDraftId ? (
            <Card className="mb-4 border-income/40 bg-income-soft">
              <p className="text-sm text-income-ink">{t("ledger.draftCreated")}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href={`/ledgers/${ledgerId}/transactions/${createdDraftId}`}>
                  <Button variant="secondary" size="sm">
                    {t("voice.viewDraft")}
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => setCreatedDraftId(null)}>
                  {t("voice.startOver")}
                </Button>
              </div>
            </Card>
          ) : null}

          <VoiceTransactionView
            ledgerId={ledgerId}
            embedded
            onDraftCreated={handleDraftCreated}
          />

          <div className="mt-4">
            <Link href={`/ledgers/${ledgerId}/transactions/new`}>
              <Button variant="secondary" size="sm">
                {t("ledger.manualEntry")}
              </Button>
            </Link>
          </div>
        </section>
      ) : null}

      {error ? <ErrorMessage error={error} onRetry={retry} /> : null}

      {busy ? <LoadingBlock label={t("nav.loading")} /> : null}

      {!busy ? (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase">
              {t("txn.draftsHeading")}
            </h2>
            {drafts.length === 0 ? (
              <EmptyState message={t("txn.emptyDrafts")} />
            ) : (
              <ul className="flex flex-col gap-3">
                {drafts.map((draft) => (
                  <li key={draft.id}>
                    <Card className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <KindBadge
                            kind={draft.kind}
                            label={draft.kind === "INCOME" ? t("txn.income") : t("txn.expense")}
                          />
                          <StatusPill tone={statusTone[draft.status] ?? "neutral"}>
                            {t(`txn.status.${draft.status.toLowerCase()}` as MessageKey)}
                          </StatusPill>
                        </div>
                        <p className="hesab-numeric text-lg font-semibold" dir="ltr">
                          {formatAmount(draft.originalAmount, locale)}
                        </p>
                        <p className="truncate text-xs text-ink-muted">
                          {draft.description ? draft.description : t("txn.noDescription")}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-end">
                          <p className="text-xs text-ink-muted">{t("txn.date")}</p>
                          <p className="text-sm" dir="ltr">
                            {formatDate(draft.businessDate, locale)}
                          </p>
                        </div>
                        <Link href={`/ledgers/${ledgerId}/transactions/${draft.id}`}>
                          <Button variant="secondary" size="sm">
                            {t("txn.view")}
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase">
              {t("txn.postedHeading")}
            </h2>
            {posted.length === 0 ? (
              <EmptyState message={t("txn.emptyPosted")} />
            ) : (
              <ul className="flex flex-col gap-3">
                {posted.map((entry) => {
                  const line = entry.lines[0];
                  return (
                    <li key={entry.id}>
                      <Card className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <KindBadge
                              kind={entry.kind}
                              label={entry.kind === "INCOME" ? t("txn.income") : t("txn.expense")}
                            />
                            <span className="hesab-numeric text-xs text-ink-muted" dir="ltr">
                              #{entry.sequenceNumber}
                            </span>
                          </div>
                          <p className="hesab-numeric text-lg font-semibold" dir="ltr">
                            {formatAmount(entry.originalAmount, locale)}{" "}
                            <span className="text-xs font-normal text-ink-muted">
                              {entry.originalCurrency?.code ?? ""}
                            </span>
                          </p>
                          <p className="truncate text-xs text-ink-muted">
                            {[
                              line?.account?.name,
                              line?.category?.name,
                              line?.categoryItem?.name,
                            ]
                              .filter(Boolean)
                              .join(" · ") || t("txn.noDescription")}
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="text-xs text-ink-muted">{t("txn.date")}</p>
                          <p className="text-sm" dir="ltr">
                            {formatDate(entry.businessDate, locale)}
                          </p>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}