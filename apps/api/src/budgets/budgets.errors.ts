/** Rejections carry a stable code so clients can branch without parsing prose. */
export const BUDGET_ERROR_CODES = {
  /** `Ledger.budgetsEnabled` is false; §14 keeps the feature opt-in per ledger. */
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  /** Both `fixedAmount` and the percentage pair were sent, or neither matched the type. */
  LIMIT_EXCLUSIVE: 'BUDGET_LIMIT_EXCLUSIVE',
  /** Same exclusivity rule for `numericThreshold` versus `percentThreshold`. */
  THRESHOLD_EXCLUSIVE: 'ALERT_THRESHOLD_EXCLUSIVE',
  /** The ledger has no posted entries yet, so a percentage basis cannot resolve. */
  BASIS_UNAVAILABLE: 'PERCENT_BASIS_UNAVAILABLE',
  ARCHIVED: 'BUDGET_ARCHIVED',
} as const;

export type BudgetErrorCode = (typeof BUDGET_ERROR_CODES)[keyof typeof BUDGET_ERROR_CODES];