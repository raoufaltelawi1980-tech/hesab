import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionsListView } from "@/components/transactions/TransactionsListView";
import { renderWithProviders } from "@/test/Providers";
import {
  LEDGER_ID,
  isGet,
  isPost,
  json,
  stubFetchRoutes,
  stubLedgerContextFetch,
  type Route,
} from "@/test/ledgerContext";

const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: "/ledgers" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => nav.pathname,
}));

const DRAFT = {
  id: "draft-1",
  kind: "EXPENSE",
  status: "DRAFT",
  description: "إيجار الشهر",
  businessDate: "2026-04-05T00:00:00.000Z",
  originalAmount: "250000",
  originalCurrencyId: "cur-1",
  lines: [
    { id: "line-1", accountId: "acc-1", categoryId: "cat-1", categoryItemId: null, amount: "250000" },
  ],
};

const ENTRY = {
  id: "entry-1",
  sequenceNumber: 12,
  kind: "INCOME",
  description: null,
  businessDate: "2026-04-04T00:00:00.000Z",
  originalAmount: "75000",
  originalCurrency: { code: "IQD" },
  lines: [
    {
      id: "line-9",
      direction: "DEBIT",
      amount: "75000",
      account: { name: "نقدي" },
      category: { name: "المبيعات" },
      categoryItem: { name: "مبيعات نقدية" },
    },
  ],
};

/** A confirmable voice card so the embedded recorder can reach "create draft". */
const COMPLETE_CARD = {
  cardId: "a".repeat(64),
  kind: "SALE_CASH",
  kindLabelAr: "بيع نقدي",
  amount: "300",
  currencyCode: "IQD",
  businessDate: null,
  financialAccountId: "acc-1",
  accountName: "نقدي",
  categoryId: "cat-1",
  categoryName: "المصاريف التشغيلية",
  categoryItemId: null,
  categoryItemName: null,
  contactId: null,
  contactName: null,
  productId: null,
  productName: null,
  quantity: null,
  description: null,
  language: "ar",
  confidence: 0.9,
  missingFields: [],
  warnings: [],
  confirmable: true,
};

const voiceRoutes: Route[] = [
  [isPost("/voice/transcribe"), { text: "بيع نقدي 300 دينار", language: "ar", confidence: 0.9 }],
  [isPost("/voice/parse"), { card: COMPLETE_CARD }],
  [isPost("/voice/confirm"), { message: "تم", review: {}, draft: { id: "draft-7" } }],
];

/** `/transactions/drafts` (bare suffix) must not shadow `/transactions`. */
const isDraftsList = isGet("/transactions/drafts");
const isPostedList = isGet(`/ledgers/${LEDGER_ID}/transactions`);

function stubListRoutes({
  drafts = [] as unknown[],
  posted = [] as unknown[],
  permissions = { isOwner: true, permissions: [] as string[] },
  voice = [] as Route[],
} = {}) {
  return stubFetchRoutes([
    ...voice,
    [isDraftsList, drafts],
    [isPostedList, posted],
    [isGet("/my-permissions"), permissions],
    [isGet("/accounts"), []],
    [isGet("/categories"), []],
    [isGet(`/ledgers/${LEDGER_ID}`), { id: LEDGER_ID, name: "متجري", baseCurrency: null }],
  ]);
}

beforeEach(() => {
  nav.push.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TransactionsListView", () => {
  it("renders drafts and posted entries with their amounts and labels", async () => {
    stubLedgerContextFetch();
    stubListRoutes({ drafts: [DRAFT], posted: [ENTRY] });

    renderWithProviders(<TransactionsListView ledgerId={LEDGER_ID} />, { locale: "en" });

    expect(await screen.findByText("إيجار الشهر")).toBeInTheDocument();
    expect(screen.getByText("250,000")).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
    expect(screen.getByText(/75,000/)).toBeInTheDocument();
    expect(screen.getByText("نقدي · المبيعات · مبيعات نقدية")).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("ltr");
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      `/ledgers/${LEDGER_ID}/transactions/draft-1`,
    );
  });

  it("shows empty states when the ledger has no transactions yet", async () => {
    stubLedgerContextFetch();
    stubListRoutes();

    renderWithProviders(<TransactionsListView ledgerId={LEDGER_ID} />);

    expect(await screen.findByText("لا توجد مسودات")).toBeInTheDocument();
    expect(screen.getByText("لا توجد عمليات معتمدة")).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("makes voice the primary entry and keeps manual entry as a fallback", async () => {
    stubListRoutes();

    renderWithProviders(<TransactionsListView ledgerId={LEDGER_ID} />);

    expect(await screen.findByText("سجّل عملية بالصوت")).toBeInTheDocument();
    expect(await screen.findByText("١. سجّل الصوت أو ارفعه")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "إدخال يدوي" })).toHaveAttribute(
      "href",
      `/ledgers/${LEDGER_ID}/transactions/new`,
    );
  });

  it("refreshes the drafts list after a voice draft is created, without posting", async () => {
    const user = userEvent.setup();
    const fetchMock = stubListRoutes({ voice: voiceRoutes });

    renderWithProviders(<TransactionsListView ledgerId={LEDGER_ID} />);
    await screen.findByText("لا توجد مسودات");

    const file = new File(["audio"], "clip.webm", { type: "audio/webm" });
    await user.upload(await screen.findByLabelText(/اختر ملفًا صوتيًا/), file);
    await user.click(screen.getByRole("button", { name: "تفريغ الصوت" }));
    await screen.findByDisplayValue("بيع نقدي 300 دينار");
    await user.click(screen.getByRole("button", { name: "حلّل النص" }));
    await screen.findByDisplayValue("بيع نقدي");
    await user.click(screen.getByRole("button", { name: "أنشئ المسودة" }));

    expect(await screen.findByText("تم إنشاء المسودة وإرسالها للمراجعة")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "اعتماد" })).toBeNull();
    expect(screen.getByRole("link", { name: "اعرض المسودة" })).toHaveAttribute(
      "href",
      `/ledgers/${LEDGER_ID}/transactions/draft-7`,
    );

    const draftsCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/transactions/drafts"),
    );
    expect(draftsCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("reports a load failure and recovers when the user retries", async () => {
    const user = userEvent.setup();
    let failing = true;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/accounts") || url.endsWith("/categories")) return json([]);
        if (url.endsWith("/my-permissions")) return json({ isOwner: true, permissions: [] });
        if (url.endsWith(`/ledgers/${LEDGER_ID}`)) return json({ id: LEDGER_ID, name: "م" });
        return failing ? json({ message: "boom" }, 500) : json([]);
      }),
    );

    renderWithProviders(<TransactionsListView ledgerId={LEDGER_ID} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("خطأ في الخادم");

    failing = false;
    await user.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(await screen.findByText("لا توجد مسودات")).toBeInTheDocument();
  });

  it("replaces the voice entry with a translated notice when the member has no create permission", async () => {
    stubListRoutes({ permissions: { isOwner: false, permissions: ["ENTRY_VIEW"] } });

    renderWithProviders(<TransactionsListView ledgerId={LEDGER_ID} />);

    await screen.findByText("لا توجد مسودات");
    expect(screen.getByText("لا تملك صلاحية الإدخال في هذا الدفتر")).toBeInTheDocument();
    expect(screen.queryByText("سجّل عملية بالصوت")).toBeNull();
    expect(screen.queryByRole("link", { name: "إدخال يدوي" })).toBeNull();
  });

  it("shows the manual entry action to an owner", async () => {
    stubListRoutes({ permissions: { isOwner: true, permissions: [] } });

    renderWithProviders(<TransactionsListView ledgerId={LEDGER_ID} />);

    expect(await screen.findByRole("link", { name: "إدخال يدوي" })).toHaveAttribute(
      "href",
      `/ledgers/${LEDGER_ID}/transactions/new`,
    );
  });
});
