import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionReviewView } from "@/components/transactions/TransactionReviewView";
import { renderWithProviders } from "@/test/Providers";
import {
  CASH_ACCOUNT,
  EXPENSE_CATEGORY,
  LEDGER_ID,
  isGet,
  isPatch,
  isPost,
  stubFetchRoutes,
} from "@/test/ledgerContext";

const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: "/ledgers" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => nav.pathname,
}));

const DRAFT_ID = "draft-1";
const DRAFT_PATH = `/ledgers/${LEDGER_ID}/transactions/drafts/${DRAFT_ID}`;

function draftPayload(status: "DRAFT" | "CONFIRMED" | "POSTED" = "DRAFT", amount = "250000") {
  return {
    draft: {
      id: DRAFT_ID,
      kind: "EXPENSE",
      status,
      description: "إيجار الشهر",
      businessDate: "2026-04-05T00:00:00.000Z",
      originalAmount: amount,
      originalCurrencyId: "cur-1",
      lines: [
        {
          id: "line-1",
          accountId: "acc-1",
          categoryId: "cat-1",
          categoryItemId: "item-1",
          amount,
        },
      ],
    },
    review: {
      message: "مسودة",
      typeAr: "صادر",
      amount,
      currency: "IQD",
      account: "نقدي",
      category: "المصاريف التشغيلية",
      categoryItem: "إيجار",
      description: "إيجار الشهر",
      businessDate: "2026-04-05T00:00:00.000Z",
    },
  };
}

function stubReview(routes: Parameters<typeof stubFetchRoutes>[0], status?: "DRAFT" | "CONFIRMED") {
  return stubFetchRoutes([
    ...routes,
    [isGet(DRAFT_PATH), draftPayload(status ?? "DRAFT")],
    [isGet("/my-permissions"), { isOwner: true, permissions: [] }],
    [isGet("/accounts"), [CASH_ACCOUNT]],
    [isGet("/categories"), [EXPENSE_CATEGORY]],
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

describe("TransactionReviewView", () => {
  it("shows the review summary with account, category and sub-item names", async () => {
    // A confirmed draft renders a read-only summary, so the names below are unique.
    stubReview([], "CONFIRMED");

    renderWithProviders(<TransactionReviewView ledgerId={LEDGER_ID} draftId={DRAFT_ID} />, {
      locale: "en",
    });

    expect(await screen.findByText(/250,000/)).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("ltr");
    expect(screen.getByText("نقدي")).toBeInTheDocument();
    expect(screen.getByText("المصاريف التشغيلية")).toBeInTheDocument();
    expect(screen.getByText("إيجار")).toBeInTheDocument();
  });

  it("saves edits made to a draft and reports success", async () => {
    const user = userEvent.setup();
    const fetchMock = stubReview([
      [isPatch(DRAFT_PATH), { message: "تم الحفظ", review: draftPayload("DRAFT", "300000").review }],
    ]);

    renderWithProviders(<TransactionReviewView ledgerId={LEDGER_ID} draftId={DRAFT_ID} />);

    const amountField = await screen.findByLabelText(/المبلغ/);
    await user.clear(amountField);
    await user.type(amountField, "300000");
    await user.click(screen.getByRole("button", { name: "حفظ" }));

    expect(await screen.findByText("تم حفظ التعديلات")).toBeInTheDocument();

    const patchCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit)?.method === "PATCH",
    );
    expect(JSON.parse(String((patchCall?.[1] as RequestInit).body))).toMatchObject({
      amount: "300000",
      financialAccountId: "acc-1",
      categoryId: "cat-1",
      categoryItemId: "item-1",
      businessDate: "2026-04-05",
    });
  });

  it("confirms a draft and then enables posting", async () => {
    const user = userEvent.setup();
    stubReview([
      [isPost(`/transactions/drafts/${DRAFT_ID}/confirm`), { message: "تم التأكيد", review: null }],
      [isPost(`/transactions/drafts/${DRAFT_ID}/post`), { message: "تم الاعتماد", entryId: "entry-7" }],
    ]);

    renderWithProviders(<TransactionReviewView ledgerId={LEDGER_ID} draftId={DRAFT_ID} />);

    const postButton = await screen.findByRole("button", { name: "اعتماد العملية" });
    expect(postButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "تأكيد المسودة" }));
    expect(await screen.findByText("تم التأكيد، جاهزة للاعتماد")).toBeInTheDocument();
  });

  it("posts a confirmed draft and shows the resulting entry reference", async () => {
    const user = userEvent.setup();
    stubReview(
      [
        [isPost(`/transactions/drafts/${DRAFT_ID}/post`), { message: "تم الاعتماد", entryId: "entry-7" }],
        [isPost(`/transactions/drafts/${DRAFT_ID}/confirm`), { message: "تم التأكيد", review: null }],
      ],
      "CONFIRMED",
    );

    renderWithProviders(<TransactionReviewView ledgerId={LEDGER_ID} draftId={DRAFT_ID} />);

    await user.click(await screen.findByRole("button", { name: "اعتماد العملية" }));

    expect(await screen.findByText("تم اعتماد العملية بنجاح")).toBeInTheDocument();
    expect(screen.getByText("رقم القيد")).toBeInTheDocument();
  });

  it("locks editing once the transaction is confirmed", async () => {
    stubReview([], "CONFIRMED");

    renderWithProviders(<TransactionReviewView ledgerId={LEDGER_ID} draftId={DRAFT_ID} />);

    expect(
      await screen.findByText("لا يمكن تعديل عملية مؤكدة أو معتمدة"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "حفظ" })).toBeNull();
    expect(screen.getByRole("button", { name: "تأكيد المسودة" })).toBeDisabled();
  });

  it("reports an action failure without losing the review", async () => {
    const user = userEvent.setup();
    stubReview([[isPost(`/transactions/drafts/${DRAFT_ID}/confirm`), { message: "لا تملك الصلاحية" }, 403]]);

    renderWithProviders(<TransactionReviewView ledgerId={LEDGER_ID} draftId={DRAFT_ID} />, {
      locale: "en",
    });

    await user.click(await screen.findByRole("button", { name: "Confirm draft" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("لا تملك الصلاحية");
    expect(screen.getByText(/250,000/)).toBeInTheDocument();
  });

  it("shows the load error with a retry when the draft cannot be read", async () => {
    const user = userEvent.setup();
    stubReview([[isGet(DRAFT_PATH), { message: "غير موجود" }, 404]]);

    renderWithProviders(<TransactionReviewView ledgerId={LEDGER_ID} draftId={DRAFT_ID} />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
  });
});