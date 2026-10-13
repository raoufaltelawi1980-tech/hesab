import { vi } from "vitest";

export const LEDGER_ID = "11111111-1111-4111-8111-111111111111";

export const LEDGER = {
  id: LEDGER_ID,
  name: "متجري",
  type: "BUSINESS",
  baseCurrency: { id: "cur-1", code: "IQD" },
};

export const CASH_ACCOUNT = {
  id: "acc-1",
  name: "نقدي",
  type: "CASH",
  currency: { id: "cur-1", code: "IQD" },
};

export const EXPENSE_CATEGORY = {
  id: "cat-1",
  name: "المصاريف التشغيلية",
  colorHex: null,
  items: [
    { id: "item-1", name: "إيجار", archivedAt: null },
    { id: "item-archived", name: "مؤرشف", archivedAt: "2026-01-01T00:00:00.000Z" },
  ],
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export type Route = [match: (url: string, init?: RequestInit) => boolean, body: unknown, status?: number];

type ContextOverrides = {
  accounts?: unknown[];
  categories?: unknown[];
  permissions?: { isOwner: boolean; permissions: string[] };
  /** Checked before the ledger-context routes, for writes made by the screen. */
  overrides?: Route[];
};

/** Stubs the four GET calls `useLedgerContext` fires for one ledger. */
export function stubLedgerContextFetch({
  accounts = [CASH_ACCOUNT],
  categories = [EXPENSE_CATEGORY],
  permissions = { isOwner: true, permissions: [] },
  overrides = [],
}: ContextOverrides = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    for (const [match, body, status] of overrides) {
      if (match(url, init)) return json(body, status);
    }
    if (url.endsWith("/accounts")) return json(accounts);
    if (url.endsWith("/categories")) return json(categories);
    if (url.endsWith("/my-permissions")) return json(permissions);
    if (url.endsWith(`/ledgers/${LEDGER_ID}`)) return json(LEDGER);
    return json({ message: "Not found" }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Passes every request through to the first matching stub in `routes`. */
export function stubFetchRoutes(routes: Route[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    for (const [match, body, status] of routes) {
      if (match(url, init)) return json(body, status);
    }
    return json({ message: "Not found" }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export const isPost = (suffix: string) => (url: string, init?: RequestInit) =>
  url.endsWith(suffix) && init?.method === "POST";
export const isPatch = (suffix: string) => (url: string, init?: RequestInit) =>
  url.endsWith(suffix) && init?.method === "PATCH";
export const isDelete = (suffix: string) => (url: string, init?: RequestInit) =>
  url.endsWith(suffix) && init?.method === "DELETE";
export const isGet = (suffix: string) => (url: string) => url.endsWith(suffix);