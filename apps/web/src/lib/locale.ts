export type Locale = "ar" | "en";

export const DEFAULT_LOCALE: Locale = "ar";

export const LOCALE_STORAGE_KEY = "hesab.locale";

export function isLocale(value: unknown): value is Locale {
  return value === "ar" || value === "en";
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}