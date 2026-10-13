"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { HesabLogoLocalized } from "@/components/brand/HesabLogo";
import { useLocale, useTranslations } from "@/components/LocaleProvider";
import { useSession } from "@/components/SessionProvider";
import { logout } from "@/lib/api-client";

export function AppShell({
  title,
  subtitle,
  ledgerHref,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  /** When set, renders a back link to the ledger list. */
  ledgerHref?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations();
  const { locale, setLocale } = useLocale();
  const { token, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  async function handleSignOut() {
    await logout(token);
    signOut();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-base text-ink-primary">
      <header className="border-b border-line-subtle bg-surface-raised">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/ledgers" aria-label={t("app.name")}>
            <HesabLogoLocalized
              locale={locale}
              size="sm"
              title={t("app.name")}
              className="text-brand-ivory"
            />
          </Link>

          <nav className="ms-auto flex items-center gap-2">
            {pathname !== "/pricing" ? (
              <Link
                href="/pricing"
                className="rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:border-accent hover:text-ink-primary"
              >
                {t("price.navLabel")}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
              className="rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:border-accent hover:text-ink-primary"
              aria-label={t("nav.switchLanguage")}
            >
              {t("nav.switchLanguage")}
            </button>
            {pathname !== "/ledgers" ? (
              <Link
                href="/ledgers"
                className="rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:border-accent hover:text-ink-primary"
              >
                {t("nav.ledgers")}
              </Link>
            ) : null}
            {token ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:border-accent hover:text-ink-primary"
              >
                {t("nav.logout")}
              </button>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            {ledgerHref ? (
              <Link
                href={ledgerHref}
                className="mb-1 inline-block text-xs text-ink-muted hover:text-accent"
              >
                ← {t("nav.ledgers")}
              </Link>
            ) : null}
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>

        {children}
      </main>
    </div>
  );
}