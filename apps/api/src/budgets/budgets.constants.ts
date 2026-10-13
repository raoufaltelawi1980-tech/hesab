import type { TransactionKind } from '@prisma/client';

/**
 * Vocabularies mirrored from `prisma/schema.prisma`. They live here as literal
 * tuples so the DTOs and the service validate against one source, and so the
 * service can narrow `string` inputs without casting through `any`.
 */

export const BUDGET_FLOWS = ['INCOME', 'EXPENSE'] as const;
export type BudgetFlow = (typeof BUDGET_FLOWS)[number];

export const BUDGET_PERIOD_TYPES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'] as const;
export type BudgetPeriodType = (typeof BUDGET_PERIOD_TYPES)[number];

export const BUDGET_LIMIT_TYPES = ['FIXED_AMOUNT', 'PERCENTAGE'] as const;
export type BudgetLimitType = (typeof BUDGET_LIMIT_TYPES)[number];

export const BUDGET_PERCENT_BASES = ['OF_TOTAL_INCOME', 'OF_TOTAL_EXPENSE'] as const;
export type BudgetPercentBasis = (typeof BUDGET_PERCENT_BASES)[number];

export const ALERT_THRESHOLD_TYPES = ['NUMERIC', 'PERCENTAGE'] as const;
export type AlertThresholdType = (typeof ALERT_THRESHOLD_TYPES)[number];

export const ALERT_TRIGGERS = ['REACH', 'EXCEED'] as const;
export type AlertTrigger = (typeof ALERT_TRIGGERS)[number];

/**
 * `Budget.flow` says وارد أم صادر, while `JournalEntry.kind` distinguishes how
 * the amount arrived. Only the kinds that genuinely create income or expense
 * count towards a budget; `TRANSFER` is excluded on purpose, because both of
 * its legs live inside the same ledger and would otherwise inflate a total.
 */
export const FLOW_KINDS: Record<BudgetFlow, TransactionKind[]> = {
  INCOME: ['INCOME', 'SALE_CASH', 'SALE_CREDIT', 'COLLECTION'],
  EXPENSE: ['EXPENSE', 'PURCHASE_CASH', 'PURCHASE_CREDIT', 'PAYMENT'],
};

/**
 * Accounting truth for the flow of a posted line. A budget never sums by
 * direction alone, it also requires the entry kind to belong to the flow.
 */
export const FLOW_DIRECTION: Record<BudgetFlow, 'CREDIT' | 'DEBIT'> = {
  INCOME: 'CREDIT',
  EXPENSE: 'DEBIT',
};