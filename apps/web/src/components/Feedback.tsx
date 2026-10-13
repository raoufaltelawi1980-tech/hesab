"use client";

import type { ReactNode } from "react";
import { ApiError, type ApiErrorKind } from "@/lib/api";
import { useTranslations } from "@/components/LocaleProvider";

const toneByKind: Record<ApiErrorKind, string> = {
  unauthorized: "border-warning/40 bg-warning-soft text-warning-ink",
  forbidden: "border-expense/40 bg-expense-soft text-expense-ink",
  notFound: "border-line-strong bg-surface-overlay text-ink-secondary",
  validation: "border-expense/40 bg-expense-soft text-expense-ink",
  rateLimit: "border-warning/40 bg-warning-soft text-warning-ink",
  network: "border-warning/40 bg-warning-soft text-warning-ink",
  server: "border-expense/40 bg-expense-soft text-expense-ink",
  unknown: "border-line-strong bg-surface-overlay text-ink-secondary",
};

const messageKeys: Record<ApiErrorKind, string> = {
  unauthorized: "error.unauthorized",
  forbidden: "error.forbidden",
  notFound: "error.notFound",
  validation: "error.validation",
  rateLimit: "error.rateLimit",
  network: "error.network",
  server: "error.server",
  unknown: "error.unknown",
};

export function ErrorMessage({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const t = useTranslations();
  if (!error) return null;

  const kind: ApiErrorKind = error instanceof ApiError ? error.kind : "unknown";
  const detail = error instanceof ApiError ? error.message : undefined;
  const headline = t(messageKeys[kind] as Parameters<typeof t>[0]);

  return (
    <div
      role="alert"
      className={`flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm ${toneByKind[kind]}`}
    >
      <span className="flex items-start gap-2">
        <span aria-hidden="true">⚠</span>
        <span className="font-medium">{headline}</span>
      </span>
      {detail && detail !== headline ? (
        <span className="ps-6 text-xs opacity-80">{detail}</span>
      ) : null}
      {onRetry ? (
        <div className="ps-6">
          <button
            type="button"
            onClick={onRetry}
            className="rounded border border-current px-2 py-1 text-xs font-medium"
          >
            {t("common.retry")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-xl border border-line-subtle bg-surface-raised p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
      {message}
    </p>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-1 py-6 text-sm text-ink-muted"
    >
      <span
        aria-hidden="true"
        className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
      {label}
    </div>
  );
}