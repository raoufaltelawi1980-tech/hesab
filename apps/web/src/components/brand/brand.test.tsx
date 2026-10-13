import { render, screen } from "@testing-library/react";
import { HesabLogo, HesabLogoLocalized } from "@/components/brand/HesabLogo";
import { BrandIdentity } from "@/components/brand/BrandIdentity";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { categoryIconMap } from "@/components/icons/icon-map";

describe("HesabLogo", () => {
  it("renders the Arabic lockup with rtl direction", () => {
    const { container } = render(<HesabLogoLocalized locale="ar" />);

    expect(screen.getByText(BrandIdentity.nameAr)).toBeInTheDocument();
    expect(container.querySelector("[dir='rtl']")).not.toBeNull();
  });

  it("drops the Arabic word and switches to ltr in English", () => {
    const { container } = render(<HesabLogoLocalized locale="en" />);

    expect(screen.queryByText(BrandIdentity.nameAr)).not.toBeInTheDocument();
    expect(screen.getByText("Hesab")).toBeInTheDocument();
    expect(container.querySelector("[dir='ltr']")).not.toBeNull();
    expect(container.querySelector("[dir='rtl']")).toBeNull();
  });

  it("uses the official mark artwork rather than a redrawn glyph", () => {
    const { container } = render(<HesabLogo onlyMark size="lg" />);

    const mark = container.querySelector("[role='presentation']");
    expect(mark).not.toBeNull();
    const style = mark?.getAttribute("style") ?? "";
    expect(style).toContain("/brand/logo-mark.svg");
  });

  it("exposes an accessible name while the artwork stays decorative", () => {
    render(<HesabLogoLocalized locale="ar" title="منصة حساب" />);

    expect(screen.getByText("منصة حساب")).toHaveClass("sr-only");
  });
});

describe("BrandIdentity", () => {
  it("uses the approved English tagline", () => {
    expect(BrandIdentity.taglineEn).toBe("Every transaction builds your account");
  });

  it("keeps the brand palette", () => {
    expect(BrandIdentity.colors.charcoal).toBe("#171817");
    expect(BrandIdentity.colors.ivory).toBe("#F1EEE4");
  });
});

describe("CategoryIcon", () => {
  it("resolves a known brand icon key", () => {
    const { container } = render(<CategoryIcon iconKey="wallet" />);

    expect(container.querySelector("svg")).toHaveClass("lucide-wallet");
  });

  it("falls back to a neutral glyph for an unknown key", () => {
    const { container } = render(<CategoryIcon iconKey="not-a-real-key" />);

    expect(container.querySelector("svg")).not.toHaveClass("lucide-wallet");
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders every mapped key without throwing", () => {
    for (const key of Object.keys(categoryIconMap)) {
      const { unmount } = render(<CategoryIcon iconKey={key} />);
      unmount();
    }
  });
});