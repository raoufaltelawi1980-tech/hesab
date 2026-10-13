import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewTransactionView } from "@/components/transactions/NewTransactionView";
import { renderWithProviders } from "@/test/Providers";
import {
  EXPENSE_CATEGORY,
  LEDGER_ID,
  isPost,
  json,
  stubLedgerContextFetch,
} from "@/test/ledgerContext";

const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: "/ledgers" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => nav.pathname,
}));

beforeEach(() => {
  nav.push.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NewTransactionView", () => {
  it("creates an expense draft from the form and navigates to review", async () => {
    const user = userEvent.setup();
    const fetchMock = stubLedgerContextFetch({
      overrides: [
        [
          isPost("/transactions/drafts"),
          { message: "تم إنشاء المسودة بنجاح", review: {}, draft: { id: "draft-99" } },
        ],
      ],
    });

    renderWithProviders(<NewTransactionView ledgerId={LEDGER_ID} />);

    await user.type(await screen.findByLabelText(/المبلغ/), "250000");
    await user.selectOptions(screen.getByLabelText(/الحساب/), "acc-1");
    await user.selectOptions(screen.getByLabelText(/^التصنيف/), "cat-1");
    await user.selectOptions(await screen.findByLabelText(/البند الفرعي/), "item-1");
    await user.type(screen.getByLabelText(/الوصف/), "إيجار الشهر");

    await user.click(screen.getByRole("button", { name: "إنشاء المسودة" }));

    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith(`/ledgers/${LEDGER_ID}/transactions/draft-99`),
    );

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/transactions/drafts") && (init as RequestInit)?.method === "POST",
    );
    expect(JSON.parse(String((postCall?.[1] as RequestInit).body))).toMatchObject({
      type: "EXPENSE",
      financialAccountId: "acc-1",
      categoryId: "cat-1",
      categoryItemId: "item-1",
      amount: "250000",
      currencyCode: "IQD",
      description: "إيجار الشهر",
    });
  });

  it("omits the sub-item and optional fields when they are left blank", async () => {
    const user = userEvent.setup();
    const fetchMock = stubLedgerContextFetch({
      overrides: [[isPost("/transactions/drafts"), { message: "ok", draft: { id: "draft-1" } }]],
    });

    renderWithProviders(<NewTransactionView ledgerId={LEDGER_ID} />);

    await user.type(await screen.findByLabelText(/المبلغ/), "10");
    await user.selectOptions(screen.getByLabelText(/الحساب/), "acc-1");
    await user.selectOptions(screen.getByLabelText(/^التصنيف/), "cat-1");
    await user.click(screen.getByRole("button", { name: "إنشاء المسودة" }));

    await waitFor(() => expect(nav.push).toHaveBeenCalled());

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/transactions/drafts") && (init as RequestInit)?.method === "POST",
    );
    const body = JSON.parse(String((postCall?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty("categoryItemId");
    expect(body).not.toHaveProperty("description");
    expect(body).not.toHaveProperty("exchangeRate");
  });

  it("does not offer archived sub-items", async () => {
    stubLedgerContextFetch();

    renderWithProviders(<NewTransactionView ledgerId={LEDGER_ID} />);

    await userEvent.setup().selectOptions(await screen.findByLabelText(/^التصنيف/), "cat-1");

    const itemSelect = screen.getByLabelText(/البند الفرعي/) as HTMLSelectElement;
    expect([...itemSelect.options].map((o) => o.value)).toEqual(["", "item-1"]);
  });

  it("clears a sub-item that no longer applies after switching category", async () => {
    const user = userEvent.setup();
    stubLedgerContextFetch({
      categories: [
        EXPENSE_CATEGORY,
        { id: "cat-2", name: "الدخل", colorHex: null, items: [] },
      ],
    });

    renderWithProviders(<NewTransactionView ledgerId={LEDGER_ID} />);
    await user.selectOptions(await screen.findByLabelText(/^التصنيف/), "cat-1");
    await user.selectOptions(await screen.findByLabelText(/البند الفرعي/), "item-1");
    expect((screen.getByLabelText(/البند الفرعي/) as HTMLSelectElement).value).toBe("item-1");

    await user.selectOptions(screen.getByLabelText(/^التصنيف/), "cat-2");
    await waitFor(() =>
      expect((screen.getByLabelText(/البند الفرعي/) as HTMLSelectElement).value).toBe(""),
    );
  });

  it("switches the draft type to income", async () => {
    const user = userEvent.setup();
    stubLedgerContextFetch();

    renderWithProviders(<NewTransactionView ledgerId={LEDGER_ID} />);

    await user.click(await screen.findByLabelText(/وارد/));
    expect(screen.getByLabelText(/وارد/)).toBeChecked();
    expect(screen.getByLabelText(/صادر/)).not.toBeChecked();
  });

  it("warns and blocks submission when the member cannot create transactions", async () => {
    stubLedgerContextFetch({
      accounts: [],
      categories: [],
      permissions: { isOwner: false, permissions: ["ENTRY_VIEW"] },
    });

    renderWithProviders(<NewTransactionView ledgerId={LEDGER_ID} />);

    expect(await screen.findByText("لا تملك صلاحية إنشاء العمليات")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إنشاء المسودة" })).toBeDisabled();
  });

  it("keeps the user on the form and reports the failure when the draft is rejected", async () => {
    const user = userEvent.setup();
    stubLedgerContextFetch({
      overrides: [[isPost("/transactions/drafts"), { message: "المبلغ مطلوب" }, 422]],
    });

    renderWithProviders(<NewTransactionView ledgerId={LEDGER_ID} />);

    await user.type(await screen.findByLabelText(/المبلغ/), "10");
    await user.selectOptions(screen.getByLabelText(/الحساب/), "acc-1");
    await user.selectOptions(screen.getByLabelText(/^التصنيف/), "cat-1");
    await user.click(screen.getByRole("button", { name: "إنشاء المسودة" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("المبلغ مطلوب");
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("surfaces a server failure with a retry affordance", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "boom" }, 500)));

    renderWithProviders(<NewTransactionView ledgerId={LEDGER_ID} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("خطأ في الخادم");

    await user.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
  });

  it("warns when the ledger has no accounts or categories", async () => {
    stubLedgerContextFetch({ accounts: [], categories: [] });

    renderWithProviders(<NewTransactionView ledgerId={LEDGER_ID} />);

    expect(await screen.findByText("لا توجد حسابات في هذا الدفتر")).toBeInTheDocument();
    expect(screen.getByText("لا توجد تصنيفات في هذا الدفتر")).toBeInTheDocument();
  });

  it("renders the loading state before the ledger context resolves", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    renderWithProviders(<NewTransactionView ledgerId={LEDGER_ID} />);

    expect(screen.getByText(/جارٍ التحميل/)).toBeInTheDocument();
  });
});