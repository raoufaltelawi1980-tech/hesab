import { API_BASE_URL } from "@/lib/api";
import {
  can,
  canPost,
  fetchReportAccounts,
  fetchReportBudgetComparison,
  fetchReportCategories,
  fetchReportSummary,
  fetchReportTimeseries,
  requestPasswordReset,
  resetPassword,
  type LedgerPermissions,
} from "@/lib/api-client";

const owner: LedgerPermissions = { isOwner: true, permissions: [] };
const member: LedgerPermissions = {
  isOwner: false,
  permissions: ["ENTRY_VIEW", "ENTRY_CREATE"],
};

describe("permission mapping", () => {
  it("grants everything to the owner", () => {
    expect(can(owner, "create")).toBe(true);
    expect(can(owner, "confirm")).toBe(true);
    expect(canPost(owner)).toBe(true);
  });

  it("maps the unified Permission enum vocabulary returned by my-permissions", () => {
    expect(can(member, "view")).toBe(true);
    expect(can(member, "create")).toBe(true);
    expect(can(member, "confirm")).toBe(false);
  });

  it("ignores the legacy *_TRANSACTIONS vocabulary", () => {
    const legacy: LedgerPermissions = {
      isOwner: false,
      permissions: ["VIEW_LEDGER", "VIEW_TRANSACTIONS", "CREATE_TRANSACTIONS"],
    };
    expect(can(legacy, "view")).toBe(false);
    expect(can(legacy, "create")).toBe(false);
  });

  it("accepts the ENTRY_* vocabulary used by TransactionsService", () => {
    const entryMember: LedgerPermissions = {
      isOwner: false,
      permissions: ["ENTRY_VIEW", "ENTRY_CREATE", "ENTRY_CONFIRM"],
    };
    expect(can(entryMember, "view")).toBe(true);
    expect(can(entryMember, "create")).toBe(true);
    expect(can(entryMember, "confirm")).toBe(true);
  });

  it("denies everything without permissions loaded", () => {
    expect(can(null, "view")).toBe(false);
    expect(can(null, "create")).toBe(false);
    expect(canPost(null)).toBe(false);
  });

  it("treats posting as owner-only, since no grantable permission maps to ENTRY_POST", () => {
    const allPermissions: LedgerPermissions = {
      isOwner: false,
      permissions: ["ENTRY_VIEW", "ENTRY_CREATE", "ENTRY_CONFIRM", "ENTRY_POST"],
    };
    expect(can(allPermissions, "confirm")).toBe(true);
    expect(canPost(allPermissions)).toBe(false);
  });

  it("maps budget permissions without an alias, since the API gates on the exact names", () => {
    const viewer: LedgerPermissions = { isOwner: false, permissions: ["BUDGET_VIEW"] };
    expect(can(viewer, "budgetView")).toBe(true);
    expect(can(viewer, "budgetManage")).toBe(false);

    const manager: LedgerPermissions = { isOwner: false, permissions: ["BUDGET_MANAGE"] };
    expect(can(manager, "budgetManage")).toBe(true);
    expect(can(manager, "budgetView")).toBe(false);

    expect(can(owner, "budgetView")).toBe(true);
    expect(can(owner, "budgetManage")).toBe(true);
    expect(can(null, "budgetView")).toBe(false);
  });

  it("maps report viewing to REPORT_VIEW", () => {
    const viewer: LedgerPermissions = { isOwner: false, permissions: ["REPORT_VIEW"] };
    expect(can(viewer, "reportView")).toBe(true);
    expect(can(viewer, "budgetView")).toBe(false);
    expect(can(owner, "reportView")).toBe(true);
    expect(can(null, "reportView")).toBe(false);
  });
});

describe("report requests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the summary URL with from/to and the bearer token", async () => {
    const body = {
      ledgerId: "l1",
      period: { from: "2025-01-01", to: "2025-01-31" },
      currency: "c1",
      totalIncome: "100.0000",
      totalExpense: "30.0000",
      net: "70.0000",
      netProfitLoss: "70.0000",
      salesTotal: "0.0000",
      purchasesTotal: "0.0000",
      operatingExpense: "30.0000",
      count: 2,
      generatedAt: "2025-02-01T00:00:00.000Z",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchReportSummary("tok", "l1", { from: "2025-01-01", to: "2025-01-31" });

    expect(result).toEqual(body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/ledgers/l1/reports/summary?from=2025-01-01&to=2025-01-31`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.body).toBeUndefined();
  });

  it("omits the query string when no range is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchReportTimeseries("tok", "l1");

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/ledgers/l1/reports/timeseries`);
  });

  it.each([
    ["categories", fetchReportCategories],
    ["accounts", fetchReportAccounts],
    ["budget-comparison", fetchReportBudgetComparison],
  ] as const)("hits /reports/%s", async (report, fetchFn) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchFn("tok", "l1", { from: "2025-01-01", to: "2025-01-31" });

    expect(String(fetchMock.mock.calls[0][0])).toContain(`/ledgers/l1/reports/${report}?from=2025-01-01&to=2025-01-31`);
  });
});

describe("account recovery", () => {
  it("requests a reset without sending a bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "ok" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestPasswordReset("a@b.com");

    expect(result.message).toBe("ok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/auth/forgot-password`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.com" });
  });

  it("submits the token and the new password", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await resetPassword("raw-token", "new-secret");

    expect(result.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/auth/reset-password`);
    expect(JSON.parse(init.body)).toEqual({ token: "raw-token", password: "new-secret" });
  });
});