"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { HesabLogoLocalized } from "@/components/brand/HesabLogo";
import { Button } from "@/components/Button";
import { ErrorMessage } from "@/components/Feedback";
import { Field, TextInput } from "@/components/Form";
import { useLocale, useTranslations } from "@/components/LocaleProvider";
import { useSession } from "@/components/SessionProvider";
import { login } from "@/lib/api-client";

export function LoginForm() {
  const t = useTranslations();
  const { locale, setLocale } = useLocale();
  const { token, ready, setToken } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && token) router.replace("/ledgers");
  }, [ready, token, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const accessToken = await login(email.trim(), password);
      setToken(accessToken);
      router.replace("/ledgers");
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
            <h1 className="text-xl font-semibold tracking-tight">{t("login.title")}</h1>
            <p className="mt-1 text-sm text-ink-muted">{t("login.subtitle")}</p>
          </div>

          {error ? <ErrorMessage error={error} /> : null}

          <Field label={t("login.email")} htmlFor="email" required>
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

          <Field label={t("login.password")} htmlFor="password" required>
            <TextInput
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Button type="submit" loading={submitting}>
            {submitting ? t("login.submitting") : t("login.submit")}
          </Button>

          <Link
            href="/forgot-password"
            className="text-center text-xs font-medium text-ink-secondary hover:text-ink-primary"
          >
            {t("login.forgot")}
          </Link>
        </form>
      </div>
    </div>
  );
}