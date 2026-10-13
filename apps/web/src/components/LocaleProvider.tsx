"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, dirFor, isLocale, type Locale } from "@/lib/locale";
import { translate, type MessageKey } from "@/lib/messages";

type LocaleContextValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration after SSR
    if (isLocale(stored) && stored !== initialLocale) setLocaleState(stored);
  }, [initialLocale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  }, []);

  const value = useMemo<LocaleContextValue>(() => {
    const dir = dirFor(locale);
    return {
      locale,
      dir,
      setLocale,
      t: (key: MessageKey) => translate(locale, key),
    };
  }, [locale, setLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = value.dir;
  }, [locale, value.dir]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside LocaleProvider");
  return ctx;
}

export function useTranslations(): LocaleContextValue["t"] {
  return useLocale().t;
}