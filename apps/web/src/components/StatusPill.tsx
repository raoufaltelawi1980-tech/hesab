"use client";

import type { ReactNode } from "react";

type Tone = "neutral" | "income" | "expense" | "warning" | "info";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-overlay text-ink-secondary border-line-subtle",
  income: "bg-income-soft text-income-ink border-income/40",
  expense: "bg-expense-soft text-expense-ink border-expense/40",
  warning: "bg-warning-soft text-warning-ink border-warning/40",
  info: "bg-info-soft text-info-ink border-info/40",
};

export function StatusPill({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: Tone;
  /** Never rely on color alone — the label carries the meaning. */
  icon?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}

export function KindBadge({ kind, label }: { kind: "INCOME" | "EXPENSE"; label: string }) {
  const income = kind === "INCOME";
  return (
    <StatusPill tone={income ? "income" : "expense"} icon={income ? "▲" : "▼"}>
      {label}
    </StatusPill>
  );
}