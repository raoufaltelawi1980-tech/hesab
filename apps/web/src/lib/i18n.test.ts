import { dirFor, isLocale } from "@/lib/locale";
import { MESSAGE_KEYS, translate } from "@/lib/messages";
import { formatAmount, formatDate, todayIso } from "@/lib/format";

describe("locale", () => {
  it("maps Arabic to RTL and English to LTR", () => {
    expect(dirFor("ar")).toBe("rtl");
    expect(dirFor("en")).toBe("ltr");
  });

  it("rejects unknown locales", () => {
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe("messages", () => {
  it("translates both directions", () => {
    expect(translate("ar", "txn.income")).toBe("وارد");
    expect(translate("en", "txn.income")).toBe("Income");
    expect(translate("en", "txn.expense")).toBe("Expense");
  });

  it("has no empty label in either dictionary", () => {
    for (const key of MESSAGE_KEYS) {
      expect(translate("ar", key).trim(), `ar:${key}`).not.toBe("");
      expect(translate("en", key).trim(), `en:${key}`).not.toBe("");
    }
  });
});

describe("formatting", () => {
  it("renders decimal amounts without float artefacts", () => {
    expect(formatAmount("1250.5000", "en")).toBe("1,250.5");
    expect(formatAmount(1250.5, "en")).toBe("1,250.5");
  });

  it("falls back to a dash for missing amounts", () => {
    expect(formatAmount(null, "en")).toBe("—");
    expect(formatAmount(undefined, "ar")).toBe("—");
    expect(formatAmount("", "en")).toBe("—");
  });

  it("formats ISO and date-only values", () => {
    expect(formatDate("2026-10-04", "en")).toBe("04 Oct 2026");
    expect(formatDate(null, "en")).toBe("—");
  });

  it("produces a YYYY-MM-DD today value", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});