"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LoadingBlock } from "@/components/Feedback";
import { useTranslations } from "@/components/LocaleProvider";
import { useSession } from "@/components/SessionProvider";

/**
 * Client-side gate. The API holds the real authorization boundary; this only
 * avoids rendering protected screens for a user with no local session.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { token, ready } = useSession();
  const router = useRouter();
  const t = useTranslations();

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  if (!ready || !token) return <LoadingBlock label={t("nav.loading")} />;
  return <>{children}</>;
}