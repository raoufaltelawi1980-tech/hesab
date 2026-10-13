import type { Locale } from "./locale";

/**
 * Amounts cross the API as decimal strings per the contract, but the current
 * Nest implementation serialises Prisma decimals as JS numbers. Both are
 * accepted; the value is only ever rendered, never computed on.
 */
export function formatAmount(value: number | string | null | undefined, locale: Locale): string {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat(locale === "ar" ? "ar-IQ" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(numeric);
}

/** `2026-10-04` / ISO string → locale-formatted date. */
export function formatDate(value: string | null | undefined, locale: Locale): string {
  if (!value) return "—";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-IQ" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}