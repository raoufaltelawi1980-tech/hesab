"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { HesabLogoLocalized } from "@/components/brand/HesabLogo";
import { Button } from "@/components/Button";
import { ErrorMessage } from "@/components/Feedback";
import { Field, TextInput } from "@/components/Form";
import { useLocale, useTranslations } from "@/components/LocaleProvider";
import { resetPassword } from "@/lib/api-client";

/**
 * Reads the recovery token from the URL. `token` is only ever shown as a link
 * delivered by the email provider; the page never displays or stores it.
 */
export function ResetPasswordForm({ token: tokenProp }: { token?: string } = {}) {
  const t = useTranslations();
  const { locale, setLocale } = useLocale();

  const [token, setToken] = useState<string>(tokenProp ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [mismatch, setMismatch] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (tokenProp !== undefined) return;
    // The token arrives in the query string, which is unavailable during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration after SSR
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, [tokenProp]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMismatch(false);
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <HesabLogoLocalized
            locale={locale}
            size="sm"
            title={t("app.name")}
            className="text-brand-ivory"
          />
          <button
            type="button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            className="rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:border-accent hover:text-ink-primary"
          >
            {t("nav.switchLanguage")}
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-line-subtle bg-surface-raised p-6"
        >
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t("auth.reset.title")}</h1>
            <p className="mt-1 text-sm text-ink-muted">{t("auth.reset.subtitle")}</p>
          </div>

          {error ? <ErrorMessage error={error} /> : null}

          {!token ? (
            <p role="alert" className="text-sm text-expense-ink">
              {t("auth.reset.missingToken")}
            </p>
          ) : done ? (
            <p
              role="status"
              className="rounded-lg border border-line-strong bg-surface-overlay px-4 py-3 text-sm text-ink-secondary"
            >
              {t("auth.reset.success")}
            </p>
          ) : (
            <>
              <Field label={t("auth.reset.password")} htmlFor="password" required>
                <TextInput
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  dir="ltr"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>

              <Field
                label={t("auth.reset.confirm")}
                htmlFor="confirm"
                required
                error={mismatch ? t("auth.reset.mismatch") : undefined}
              >
                <TextInput
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  dir="ltr"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>

              <Button type="submit" loading={submitting}>
                {submitting ? t("auth.reset.submitting") : t("auth.reset.submit")}
              </Button>
            </>
          )}

          <Link
            href="/login"
            className="text-center text-xs font-medium text-ink-secondary hover:text-ink-primary"
          >
            {t("auth.reset.goToLogin")}
          </Link>
        </form>
      </div>
    </div>
  );
}
