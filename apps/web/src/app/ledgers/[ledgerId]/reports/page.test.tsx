import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReportsPage from "./page";
import { renderWithProviders } from "@/test/Providers";
import { formatAmount } from "@/lib/format";
import {
  EXPENSE_CATEGORY,
  LEDGER_ID,
  isGet,
  json,
  stubFetchRoutes,
  type Route,
} from "@/test/ledgerContext";

vi.mock("next/navigation", () => ({
  useParams: () => ({ ledgerId: "11111111-1111-4111-8111-111111111111" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/ledgers",
}));

const PERIOD = { from: "2026-04-01", to: "2026-04-30" };

const SUMMARY = {
  ledgerId: LEDGER_ID,
  period: PERIOD,
  currency: null,
  totalIncome: "1000000.0000",
  totalExpense: "400000.0000",
  net: "600000.0000",
  netProfitLoss: "600000.0000",
  salesTotal: "0.0000",
  purchasesTotal: "0.0000",
  operatingExpense: "0.0000",
  count: 3,
  generatedAt: "2026-04-30T10:00:00.000Z",
};

const TIMESERIES = {
  ledgerId: LEDGER_ID,
  period: PERIOD,
  currency: null,
  items: [
    { period: "2026-04-05", income: "1000000.0000", expense: "400000.0000", net: "600000.0000", count: 3 },
  ],
};

const CATEGORIES = {
  ledgerId: LEDGER_ID,
  period: PERIOD,
  currency: null,
  items: [
    {
      categoryId: "cat-1",
      categoryName: "المصاريف التشغيلية",
      categoryItemId: "item-1",
      categoryItemName: "إيجار",
      income: "0.0000",
      expense: "400000.0000",
      net: "-400000.0000",
      count: 2,
      percentOfTotal: "100.00",
    },
  ],
};

const ACCOUNTS = {
  ledgerId: LEDGER_ID,
  period: PERIOD,
  baseCurrency: null,
  items: [
    {
      accountId: "acc-1",
      accountName: "نقدي",
      currencyId: "cur-1",
      currencyCode: "IQD",
      income: "1000000.0000",
      expense: "400000.0000",
      net: "600000.0000",
      count: 3,
    },
  ],
};

const BUDGET_COMPARISON = {
  ledgerId: LEDGER_ID,
  period: PERIOD,
  currency: null,
  items: [
    {
      budgetId: "b-1",
      budgetName: "مصاريف التشغيل",
      flow: "EXPENSE",
      period: PERIOD,
      limitType: "FIXED_AMOUNT",
      limit: "500000.0000",
      executed: "400000.0000",
      remaining: "100000.0000",
      percentUsed: "80.00",
      status: "NEAR",
    },
  ],
};

const isReport = (name: string) => (url: string) => url.includes(`/reports/${name}`);
const isSummary = isReport("summary");

const PROFIT_LOSS = {
  ledgerId: LEDGER_ID,
  ledgerType: "BUSINESS",
  period: PERIOD,
  currency: null,
  resultLabel: "النتيجة التشغيلية للفترة (حسب الحركات المرحّلة)",
  basisNote: "يعتمد التقرير على القيود المرحّلة (POSTED) فقط، ولا يحتسب القيود المعكوسة.",
  excludedNote: "استُبعدت التحصيلات والمدفوعات.",
  totalSales: "1500000.0000",
  salesCount: 2,
  salesCash: "1000000.0000",
  salesCredit: "500000.0000",
  totalPurchases: "500000.0000",
  purchasesCount: 1,
  purchasesCash: "500000.0000",
  purchasesCredit: "0.0000",
  operatingExpenses: "400000.0000",
  expensesCount: 2,
  otherIncome: "0.0000",
  otherIncomeCount: 0,
  netResult: "600000.0000",
  sections: [
    {
      key: "SALES",
      label: "إجمالي المبيعات",
      total: "1500000.0000",
      count: 2,
      cash: "1000000.0000",
      credit: "500000.0000",
    },
    {
      key: "PURCHASES",
      label: "إجمالي المشتريات",
      total: "500000.0000",
      count: 1,
      cash: "500000.0000",
      credit: "0.0000",
    },
    {
      key: "OPERATING_EXPENSES",
      label: "المصروفات التشغيلية",
      total: "400000.0000",
      count: 2,
    },
  ],
  generatedAt: "2026-04-30T10:00:00.000Z",
};

function stubReports({
  summary = SUMMARY as unknown,
  profitLoss = PROFIT_LOSS as unknown,
  timeseries = TIMESERIES as unknown,
  categories = CATEGORIES as unknown,
  accounts = ACCOUNTS as unknown,
  budgetComparison = BUDGET_COMPARISON as unknown,
  permissions = { isOwner: true, permissions: [] as string[] },
  overrides = [] as Route[],
} = {}) {
  return stubFetchRoutes([
    ...overrides,
    [isGet("/accounts"), []],
    [isGet("/categories"), [EXPENSE_CATEGORY]],
    [isGet("/my-permissions"), permissions],
    [isGet(`/ledgers/${LEDGER_ID}`), { id: LEDGER_ID, name: "متجري", baseCurrency: null }],
    [isReport("summary"), summary],
    [isReport("profit-loss"), profitLoss],
    [isReport("timeseries"), timeseries],
    [isReport("categories"), categories],
    [isReport("accounts"), accounts],
    [isReport("budget-comparison"), budgetComparison],
  ]);
}

function summaryValue(label: string) {
  const region = screen.getByRole("region", { name: "الملخص" });
  const card = within(region).getByText(label).parentElement;
  return card?.querySelectorAll("p")[1]?.textContent ?? null;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ReportsPage", () => {
  it("fetches the report on mount and renders the summary values", async () => {
    const fetchMock = stubReports();

    renderWithProviders(<ReportsPage />);

    expect(await screen.findByText("الملخص")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => isSummary(String(url)))).toBe(true);

    expect(summaryValue("إجمالي الوارد")).toBe(formatAmount(SUMMARY.totalIncome, "ar"));
    expect(summaryValue("إجمالي الصادر")).toBe(formatAmount(SUMMARY.totalExpense, "ar"));
    expect(summaryValue("الصافي")).toBe(formatAmount(SUMMARY.net, "ar"));
    expect(summaryValue("عدد العمليات")).toBe("3");

    expect(screen.getByText("المصاريف التشغيلية")).toBeInTheDocument();
    expect(screen.getByText("نقدي")).toBeInTheDocument();
    expect(screen.getByText("مصاريف التشغيل")).toBeInTheDocument();
  });

  it("renders the operational result (profit & loss) section from POSTED entries", async () => {
    const fetchMock = stubReports();

    renderWithProviders(<ReportsPage />);

    const heading = await screen.findByText("النتيجة التشغيلية (الربح والخسارة)");
    expect(heading).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => isReport("profit-loss")(String(url)))).toBe(true);

    const region = screen.getByRole("region", { name: "النتيجة التشغيلية (الربح والخسارة)" });
    const netCard = within(region).getByText("النتيجة التشغيلية").parentElement;
    expect(netCard?.querySelectorAll("p")[1]?.textContent).toBe(
      formatAmount(PROFIT_LOSS.netResult, "ar"),
    );
    expect(within(region).getByText(/POSTED/)).toBeInTheDocument();
    expect(within(region).getAllByText("إجمالي المبيعات").length).toBeGreaterThanOrEqual(1);
  });

  it("shows a loading state while the report is in flight", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (isGet("/accounts")(url)) return json([]);
      if (isGet("/categories")(url)) return json([EXPENSE_CATEGORY]);
      if (isGet("/my-permissions")(url)) return json({ isOwner: true, permissions: [] });
      if (isGet(`/ledgers/${LEDGER_ID}`)(url)) return json({ id: LEDGER_ID, name: "متجري" });
      if (isSummary(url)) {
        await gate;
        return json(SUMMARY);
      }
      if (isReport("profit-loss")(url)) {
        await gate;
        return json(PROFIT_LOSS);
      }
      if (isReport("timeseries")(url)) {
        await gate;
        return json(TIMESERIES);
      }
      if (isReport("categories")(url)) {
        await gate;
        return json(CATEGORIES);
      }
      if (isReport("accounts")(url)) {
        await gate;
        return json(ACCOUNTS);
      }
      if (isReport("budget-comparison")(url)) {
        await gate;
        return json(BUDGET_COMPARISON);
      }
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<ReportsPage />);

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => isSummary(String(url)))).toBe(true),
    );
    expect(screen.getByText("جارٍ التحميل…")).toBeInTheDocument();
    expect(screen.queryByText("الملخص")).toBeNull();

    release();
    expect(await screen.findByText("الملخص")).toBeInTheDocument();
  });

  it("shows a no-data state and hides the budget comparison when there are no rows", async () => {
    stubReports({
      summary: { ...SUMMARY, count: 0 },
      timeseries: { ...TIMESERIES, items: [] },
      categories: { ...CATEGORIES, items: [] },
      accounts: { ...ACCOUNTS, items: [] },
      budgetComparison: { ...BUDGET_COMPARISON, items: [] },
    });

    renderWithProviders(<ReportsPage />);

    expect(await screen.findByText("الملخص")).toBeInTheDocument();
    expect(summaryValue("عدد العمليات")).toBe("0");
    expect(screen.getAllByText("لا توجد بيانات").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("مقارنة الميزانيات")).toBeNull();
  });

  it("surfaces an API error and recovers when the user retries", async () => {
    const user = userEvent.setup();
    let failing = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (isGet("/accounts")(url)) return json([]);
        if (isGet("/categories")(url)) return json([EXPENSE_CATEGORY]);
        if (isGet("/my-permissions")(url)) return json({ isOwner: true, permissions: [] });
        if (isGet(`/ledgers/${LEDGER_ID}`)(url)) return json({ id: LEDGER_ID, name: "متجري" });
        if (isSummary(url)) return failing ? json({ message: "boom" }, 500) : json(SUMMARY);
        if (isReport("profit-loss")(url)) return json(PROFIT_LOSS);
        if (isReport("timeseries")(url)) return json(TIMESERIES);
        if (isReport("categories")(url)) return json(CATEGORIES);
        if (isReport("accounts")(url)) return json(ACCOUNTS);
        if (isReport("budget-comparison")(url)) return json(BUDGET_COMPARISON);
        return json({}, 404);
      }),
    );

    renderWithProviders(<ReportsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("خطأ في الخادم");

    failing = false;
    await user.click(screen.getByRole("button", { name: "إعادة المحاولة" }));

    expect(await screen.findByText("الملخص")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("reloads the report for the dates the user selects", async () => {
    const user = userEvent.setup();
    const fetchMock = stubReports();

    renderWithProviders(<ReportsPage />);
    await screen.findByText("الملخص");

    fireEvent.change(screen.getByLabelText(/^من/), { target: { value: "2026-03-01" } });
    await user.click(screen.getByRole("button", { name: "تحميل التقارير" }));

    await waitFor(() => {
      const urls = fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((url) => isSummary(url));
      expect(urls.some((url) => url.includes("from=2026-03-01"))).toBe(true);
    });
  });

  it("hides the report when the user lacks the REPORT_VIEW permission", async () => {
    const fetchMock = stubReports({ permissions: { isOwner: false, permissions: [] } });

    renderWithProviders(<ReportsPage />);

    expect(await screen.findByText("لا تملك صلاحية عرض التقارير")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => isSummary(String(url)))).toBe(false);
  });

  it("renders in English with LTR when the locale is switched", async () => {
    stubReports();

    renderWithProviders(<ReportsPage />, { locale: "en" });

    expect(await screen.findByText("Reports")).toBeInTheDocument();
    expect(await screen.findByText("Summary")).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("ltr");
  });
});
