import type { MessageKey } from "@/lib/messages";
import type {
  Budget,
  BudgetFlow,
  BudgetLimitType,
  BudgetPercentBasis,
  BudgetPeriodType,
  BudgetProgress,
} from "@/lib/api-client";

/**
 * Pure label helpers. They take `t` instead of reading the locale hook so they
 * stay testable outside a React tree, and so a missing key surfaces as the key
 * rather than as an empty label.
 */
export type Translate = (key: MessageKey) => string;

const FLOW_KEYS: Record<BudgetFlow, MessageKey> = {
  INCOME: "bud.flow.income",
  EXPENSE: "bud.flow.expense",
};

const PERIOD_KEYS: Record<BudgetPeriodType, MessageKey> = {
  DAILY: "bud.period.daily",
  WEEKLY: "bud.period.weekly",
  MONTHLY: "bud.period.monthly",
  YEARLY: "bud.period.yearly",
  CUSTOM: "bud.period.custom",
};

const LIMIT_KEYS: Record<BudgetLimitType, MessageKey> = {
  FIXED_AMOUNT: "bud.limit.fixed",
  PERCENTAGE: "bud.limit.percent",
};

const BASIS_KEYS: Record<BudgetPercentBasis, MessageKey> = {
  OF_TOTAL_INCOME: "bud.basis.income",
  OF_TOTAL_EXPENSE: "bud.basis.expense",
};

export function flowLabel(t: Translate, flow: BudgetFlow): string {
  return t(FLOW_KEYS[flow]);
}

export function periodTypeLabel(t: Translate, periodType: BudgetPeriodType): string {
  return t(PERIOD_KEYS[periodType]);
}

export function limitTypeLabel(t: Translate, limitType: BudgetLimitType): string {
  return t(LIMIT_KEYS[limitType]);
}

export function percentBasisLabel(t: Translate, basis: BudgetPercentBasis | null): string {
  return basis ? t(BASIS_KEYS[basis]) : "";
}

/**
 * The one-line description of what the budget caps: a fixed figure, or a share
 * of a ledger total. `formatAmount` is a renderer, so this stays display-only.
 */
export function limitSummary(
  t: Translate,
  budget: Pick<Budget, "limitType" | "fixedAmount" | "percentValue" | "percentBasis">,
  format: (value: number | string | null) => string,
): string {
  if (budget.limitType === "FIXED_AMOUNT") {
    return `${t("bud.limit")}: ${format(budget.fixedAmount)}`;
  }
  const basis = percentBasisLabel(t, budget.percentBasis);
  return `${t("bud.percentValue")}: ${format(budget.percentValue)} — ${basis}`;
}

/**
 * Presentation tone for the progress meter. The percentage is clamped for the
 * bar width only; the server decides whether a budget is over its limit.
 */
export function progressFill(progress: BudgetProgress | null): number {
  if (!progress) return 0;
  const used = Number(progress.percentUsed);
  if (!Number.isFinite(used) || used <= 0) return 0;
  return Math.min(used, 100);
}

export function progressTone(progress: BudgetProgress | null): string {
  if (!progress) return "bg-line-strong";
  if (progress.isOverBudget) return "bg-expense";
  if (Number(progress.percentUsed) >= 80) return "bg-warning";
  return "bg-income";
}

/** Builds the create payload, keeping the limit fields exclusive. */
export function buildBudgetInput(form: {
  name: string;
  flow: BudgetFlow;
  periodType: BudgetPeriodType;
  limitType: BudgetLimitType;
  amount: string;
  percentBasis: BudgetPercentBasis;
  categoryId: string;
}) {
  const base = {
    name: form.name.trim(),
    flow: form.flow,
    periodType: form.periodType,
    limitType: form.limitType,
    ...(form.categoryId ? { categoryId: form.categoryId } : {}),
  };
  if (form.limitType === "FIXED_AMOUNT") return { ...base, fixedAmount: form.amount.trim() };
  return {
    ...base,
    percentValue: form.amount.trim(),
    percentBasis: form.percentBasis,
  };
}