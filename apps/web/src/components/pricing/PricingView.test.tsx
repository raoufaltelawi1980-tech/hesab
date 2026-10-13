import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PricingView } from "@/components/pricing/PricingView";
import { renderWithProviders } from "@/test/Providers";
import { isGet, stubFetchRoutes } from "@/test/ledgerContext";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/pricing",
}));

const PRICE = (billingCycle: string, baseAmount: string) => ({
  billingCycle,
  baseAmount,
  baseCurrency: "USD",
  displayAmount: null,
  displayCurrency: null,
  displayRate: null,
});

const PLAN = (tier: string, monthly: string, yearly: string) => ({
  tier,
  nameAr: tier === "PERSONAL" ? "شخصية" : "تجارية",
  nameEn: tier === "PERSONAL" ? "Personal" : "Business",
  prices: [PRICE("MONTHLY", monthly), PRICE("YEARLY", yearly)],
});

const CATALOG = {
  baseCurrency: "USD",
  paymentImplemented: false,
  country: null,
  countries: [
    { iso2: "QA", nameAr: "قطر", nameEn: "Qatar", level: "A" },
    { iso2: "EG", nameAr: "مصر", nameEn: "Egypt", level: "B" },
  ],
  levels: [
    {
      level: "A",
      nameAr: "المستوى A",
      nameEn: "Level A",
      plans: [PLAN("PERSONAL", "2.99", "24.99"), PLAN("BUSINESS", "9.99", "89.00")],
    },
    {
      level: "B",
      nameAr: "المستوى B",
      nameEn: "Level B",
      plans: [PLAN("PERSONAL", "1.99", "16.99"), PLAN("BUSINESS", "5.99", "54.00")],
    },
  ],
  display: {
    currency: null,
    available: false,
    noteAr: "التحويل إلى عملة العرض غير متوفّر بعد؛ تُعرض الأسعار بالدولار الأمريكي.",
    noteEn: "Display-currency conversion is not available yet; prices are shown in USD.",
  },
  notes: [{ ar: "ملاحظة", en: "note" }],
};

const isCatalog = isGet("/pricing/plans");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PricingView", () => {
  it("lists every economic level with USD prices from the catalog", async () => {
    stubFetchRoutes([[isCatalog, CATALOG]]);
    renderWithProviders(<PricingView />);

    expect(await screen.findByText("المستوى A")).toBeInTheDocument();
    expect(screen.getByText("المستوى B")).toBeInTheDocument();
    for (const amount of ["2.99 USD", "24.99 USD", "9.99 USD", "89.00 USD"]) {
      expect(screen.getByText(amount)).toBeInTheDocument();
    }
    expect(screen.getByText("1.99 USD")).toBeInTheDocument();
  });

  it("narrows the plans to the selected country's economic level", async () => {
    const user = userEvent.setup();
    stubFetchRoutes([[isCatalog, CATALOG]]);
    renderWithProviders(<PricingView />);
    await screen.findByText("المستوى A");

    await user.selectOptions(screen.getByLabelText("الدولة"), "QA");

    expect(screen.getByText("المستوى A")).toBeInTheDocument();
    expect(screen.queryByText("المستوى B")).toBeNull();
    expect(screen.getByText("2.99 USD")).toBeInTheDocument();
    expect(screen.queryByText("1.99 USD")).toBeNull();
  });

  it("filters by plan tier and then by billing cycle", async () => {
    const user = userEvent.setup();
    stubFetchRoutes([[isCatalog, CATALOG]]);
    renderWithProviders(<PricingView />);
    await screen.findByText("المستوى A");

    await user.selectOptions(screen.getByLabelText("نوع الباقة"), "BUSINESS");
    expect(screen.queryByText("2.99 USD")).toBeNull();
    expect(screen.getByText("9.99 USD")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("دورة الفوترة"), "YEARLY");
    expect(screen.queryByText("9.99 USD")).toBeNull();
    expect(screen.getByText("89.00 USD")).toBeInTheDocument();
  });

  it("states the USD base, missing display conversion and that no payment happens", async () => {
    stubFetchRoutes([[isCatalog, CATALOG]]);
    renderWithProviders(<PricingView />);

    expect(await screen.findByText(/الأسعار بالدولار الأمريكي/)).toBeInTheDocument();
    expect(screen.getByText(/التحويل إلى عملة العرض غير متوفّر/)).toBeInTheDocument();
    expect(screen.getByText(/لا يوجد دفع حقيقي/)).toBeInTheDocument();
  });

  it("surfaces a load error", async () => {
    stubFetchRoutes([[isCatalog, { message: "boom" }, 500]]);
    renderWithProviders(<PricingView />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
