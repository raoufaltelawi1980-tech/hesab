/** Rejections carry a stable code so clients can branch without parsing prose. */
export const REPORT_ERROR_CODES = {
  INVALID_RANGE: 'INVALID_RANGE',
  INVALID_DATE: 'INVALID_DATE',
  MISSING_BASE_CURRENCY: 'MISSING_BASE_CURRENCY',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  LEDGER_NOT_BUSINESS: 'LEDGER_NOT_BUSINESS',
} as const;
export type ReportErrorCode = (typeof REPORT_ERROR_CODES)[keyof typeof REPORT_ERROR_CODES];
