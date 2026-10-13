import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceTransactionView } from "@/components/transactions/VoiceTransactionView";
import { renderWithProviders } from "@/test/Providers";
import {
  LEDGER_ID,
  isPost,
  stubLedgerContextFetch,
  type Route,
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

function routes(overrides: Route[]): Route[] {
  return [
    ...overrides,
    [isPost("/voice/transcribe"), { text: "بيع نقدي 300 دينار", language: "ar", confidence: 0.9 }],
    [isPost("/voice/parse"), { card: COMPLETE_CARD }],
    [isPost("/voice/confirm"), { message: "تم", review: {}, draft: { id: "draft-7" } }],
  ];
}

async function uploadAndTranscribe(user: ReturnType<typeof userEvent.setup>) {
  const file = new File(["audio"], "clip.webm", { type: "audio/webm" });
  await user.upload(await screen.findByLabelText(/اختر ملفًا صوتيًا/), file);
  await user.click(screen.getByRole("button", { name: "تفريغ الصوت" }));
  await screen.findByDisplayValue("بيع نقدي 300 دينار");
}

describe("VoiceTransactionView", () => {
  it("transcribes, parses, and confirms into a draft without offering a post action", async () => {
    const user = userEvent.setup();
    const fetchMock = stubLedgerContextFetch({ overrides: routes([]) });

    renderWithProviders(<VoiceTransactionView ledgerId={LEDGER_ID} />);
    await uploadAndTranscribe(user);

    await user.click(screen.getByRole("button", { name: "حلّل النص" }));
    expect(await screen.findByDisplayValue("بيع نقدي")).toBeInTheDocument();
    expect(screen.getByDisplayValue("300")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "اعتماد" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "أنشئ المسودة" }));

    expect(await screen.findByText(/تم إنشاء المسودة/)).toBeInTheDocument();

    const confirmCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/voice/confirm") && (init as RequestInit)?.method === "POST",
    );
    const body = JSON.parse(String((confirmCall?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      kind: "SALE_CASH",
      amount: "300",
      currencyCode: "IQD",
      financialAccountId: "acc-1",
      categoryId: "cat-1",
    });
  });

  it("blocks confirm while the card is missing required fields", async () => {
    const user = userEvent.setup();
    stubLedgerContextFetch({
      overrides: routes([
        [
          isPost("/voice/parse"),
          {
            card: {
              ...COMPLETE_CARD,
              kind: null,
              kindLabelAr: null,
              amount: null,
              accountName: null,
              financialAccountId: null,
              categoryName: null,
              categoryId: null,
              confirmable: false,
              missingFields: ["kind", "amount"],
              warnings: ["لم يُذكر النوع"],
            },
          },
        ],
      ]),
    });

    renderWithProviders(<VoiceTransactionView ledgerId={LEDGER_ID} />);
    await uploadAndTranscribe(user);
    await user.click(screen.getByRole("button", { name: "حلّل النص" }));

    expect(await screen.findByText("حقول ناقصة تتطلّب التصحيح")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "أنشئ المسودة" })).toBeDisabled();
  });

  it("reports a transcription failure with a provider error", async () => {
    const user = userEvent.setup();
    stubLedgerContextFetch({
      overrides: [
        [
          isPost("/voice/transcribe"),
          { message: "VOICE_PROVIDER_NOT_CONFIGURED: مزوّد التفريغ غير مضبوط" },
          503,
        ],
      ],
    });

    renderWithProviders(<VoiceTransactionView ledgerId={LEDGER_ID} />);
    const file = new File(["audio"], "clip.webm", { type: "audio/webm" });
    await user.upload(await screen.findByLabelText(/اختر ملفًا صوتيًا/), file);
    await user.click(screen.getByRole("button", { name: "تفريغ الصوت" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/غير مضبوط/);
  });
});
