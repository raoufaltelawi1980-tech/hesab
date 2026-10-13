"use client";

import type { ReactNode } from "react";
import { LocaleProvider } from "@/components/LocaleProvider";
import { SessionProvider } from "@/components/SessionProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <SessionProvider>{children}</SessionProvider>
    </LocaleProvider>
  );
}