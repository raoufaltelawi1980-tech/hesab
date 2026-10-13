"use client";

import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { LocaleProvider } from "@/components/LocaleProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { LOCALE_STORAGE_KEY, type Locale } from "@/lib/locale";

function Providers({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <SessionProvider>{children}</SessionProvider>
    </LocaleProvider>
  );
}

/**
 * SessionProvider hydrates from localStorage in an effect, so a token and the
 * locale are seeded before render for protected views to appear immediately.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    token = "test-token",
    locale = null,
    ...options
  }: { token?: string | null; locale?: Locale | null } & Omit<RenderOptions, "wrapper"> = {},
): RenderResult {
  if (token === null) window.localStorage.removeItem("hesab.token");
  else window.localStorage.setItem("hesab.token", token);
  if (locale === null) window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  else window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  return render(ui, { wrapper: Providers, ...options });
}