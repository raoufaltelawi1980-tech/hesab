"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { HesabLogoLocalized } from "@/components/brand/HesabLogo";
import { Button } from "@/components/Button";
import { ErrorMessage } from "@/components/Feedback";
import { Field, TextInput } from "@/components/Form";
import { useLocale, useTranslations } from "@/components/LocaleProvider";
import { requestPasswordReset } from "@/lib/api-client";

export function ForgotPasswordForm() {
  const t = useTranslations();
  const { locale, setLocale } = useLocale();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
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
            <h1 className="text-xl font-semibold tracking-tight">{t("auth.forgot.title")}</h1>
            <p className="mt-1 text-sm text-ink-muted">{t("auth.forgot.subtitle")}</p>
          </div>

          {error ? <ErrorMessage error={error} /> : null}

          {/* The response is uniform, so this panel never reveals whether the email exists. */}
          {done ? (
            <p
              role="status"
              className="rounded-lg border border-line-strong bg-surface-overlay px-4 py-3 text-sm text-ink-secondary"
            >
              {t("auth.forgot.submitted")}
            </p>
          ) : (
            <>
              <Field label={t("auth.forgot.email")} htmlFor="email" required>
                <TextInput
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  dir="ltr"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <Button type="submit" loading={submitting}>
                {submitting ? t("auth.forgot.submitting") : t("auth.forgot.submit")}
              </Button>
            </>
          )}

          <Link
            href="/login"
            className="text-center text-xs font-medium text-ink-secondary hover:text-ink-primary"
          >
            {t("auth.forgot.backToLogin")}
          </Link>
        </form>
      </div>
    </div>
  );
}
