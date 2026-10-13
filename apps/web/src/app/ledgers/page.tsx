"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { EmptyState, ErrorMessage, LoadingBlock } from "@/components/Feedback";
import { StatusPill } from "@/components/StatusPill";
import { useTranslations } from "@/components/LocaleProvider";
import { RequireSession } from "@/components/RequireSession";
import { useSession } from "@/components/SessionProvider";
import { fetchLedgers, type LedgerSummary } from "@/lib/api-client";
import type { MessageKey } from "@/lib/messages";

function LedgerCard({ ledger, labelKey }: { ledger: LedgerSummary; labelKey: MessageKey }) {
  const t = useTranslations();
  return (
    <li>
      <Link
        href={`/ledgers/${ledger.id}/transactions`}
        className="block rounded-xl border border-line-subtle bg-surface-raised p-5 transition-colors hover:border-accent"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">{ledger.name}</h2>
          <div className="flex shrink-0 items-center gap-2">
            <StatusPill tone="info" icon="▤">
              {t(labelKey)}
            </StatusPill>
            {ledger.role ? (
              <StatusPill tone={ledger.role === "OWNER" ? "neutral" : "warning"}>
                {t(ledger.role === "OWNER" ? "ledgers.role.owner" : "ledgers.role.member")}
              </StatusPill>
            ) : null}
          </div>
        </div>
        <p className="hesab-numeric mt-3 text-sm text-ink-muted" dir="ltr">
          {ledger.baseCurrency?.code ?? "—"}
        </p>
        <span className="mt-4 inline-block text-xs font-medium text-accent">
          {t("ledgers.open")} →
        </span>
      </Link>
    </li>
  );
}

function LedgersView() {
  const t = useTranslations();
  const { token } = useSession();
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<{ ledgers: LedgerSummary[] | null; error: unknown }>({
    ledgers: null,
    error: null,
  });
  const { ledgers, error } = state;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    void (async () => {
      try {
        const next = await fetchLedgers(token, signal);
        if (signal.aborted) return;
        setState({ ledgers: next, error: null });
      } catch (caught) {
        if (signal.aborted) return;
        setState({ ledgers: [], error: caught });
      }
    })();

    return () => controller.abort();
  }, [token, reloadKey]);

  function retry() {
    setState((prev) => ({ ...prev, error: null }));
    setReloadKey((k) => k + 1);
  }

  return (
    <AppShell
      title={t("ledgers.title")}
      subtitle={t("ledgers.subtitle")}
      actions={
        <Link href="/ledgers/new">
          <Button size="sm">{t("ledgers.create")}</Button>
        </Link>
      }
    >
      {error ? <ErrorMessage error={error} onRetry={retry} /> : null}

      {ledgers === null ? <LoadingBlock label={t("nav.loading")} /> : null}

      {ledgers !== null && ledgers.length === 0 && !error ? (
        <EmptyState message={t("ledgers.empty")} />
      ) : null}

      {ledgers && ledgers.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {ledgers.map((ledger) => (
            <LedgerCard
              key={ledger.id}
              ledger={ledger}
              labelKey={ledger.type === "BUSINESS" ? "ledger.type.business" : "ledger.type.household"}
            />
          ))}
        </ul>
      ) : null}
    </AppShell>
  );
}

export default function LedgersPage() {
  return (
    <RequireSession>
      <LedgersView />
    </RequireSession>
  );
}