"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAccounts,
  fetchCategories,
  fetchLedger,
  fetchPermissions,
  type Account,
  type Category,
  type LedgerPermissions,
  type LedgerSummary,
} from "@/lib/api-client";

export type LedgerContext = {
  ledger: LedgerSummary | null;
  accounts: Account[];
  categories: Category[];
  permissions: LedgerPermissions | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
};

type Loaded = {
  /** Identifies the inputs this snapshot was fetched for, so stale data is never shown. */
  requestKey: string;
  ledger: LedgerSummary | null;
  accounts: Account[];
  categories: Category[];
  permissions: LedgerPermissions | null;
  error: unknown;
};

function requestKeyOf(
  token: string | null,
  ledgerId: string,
  reloadKey: number,
): string {
  return `${token ?? "anon"}:${ledgerId}:${reloadKey}`;
}

/** Loads everything the transaction screens need for one ledger, in one pass. */
export function useLedgerContext(token: string | null, ledgerId: string): LedgerContext {
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>({
    requestKey: "",
    ledger: null,
    accounts: [],
    categories: [],
    permissions: null,
    error: null,
  });

  const requestKey = requestKeyOf(token, ledgerId, reloadKey);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const key = requestKeyOf(token, ledgerId, reloadKey);

    void (async () => {
      try {
        const [ledger, accounts, categories, permissions] = await Promise.all([
          fetchLedger(token, ledgerId, signal),
          fetchAccounts(token, ledgerId, signal),
          fetchCategories(token, ledgerId, signal),
          fetchPermissions(token, ledgerId, signal),
        ]);
        if (signal.aborted) return;
        setLoaded({ requestKey: key, ledger, accounts, categories, permissions, error: null });
      } catch (caught) {
        if (signal.aborted) return;
        setLoaded({
          requestKey: key,
          ledger: null,
          accounts: [],
          categories: [],
          permissions: null,
          error: caught,
        });
      }
    })();

    return () => controller.abort();
  }, [token, ledgerId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const fresh = loaded.requestKey === requestKey;

  return {
    ledger: fresh ? loaded.ledger : null,
    accounts: fresh ? loaded.accounts : [],
    categories: fresh ? loaded.categories : [],
    permissions: fresh ? loaded.permissions : null,
    loading: !fresh,
    error: fresh ? loaded.error : null,
    reload,
  };
}

/** Sub-items the user can still pick: archived ones are filtered out. */
export function selectableItems(category: Category | null) {
  return (category?.items ?? []).filter((item) => item.archivedAt === null);
}