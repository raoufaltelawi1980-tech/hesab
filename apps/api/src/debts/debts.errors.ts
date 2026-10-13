/**
 * Stable error codes for debts and settlements. They are prefixed to the
 * Arabic message (`CODE: رسالة`) because responses stay text-only in this API.
 */
export const DEBT_ERROR_CODES = {
  LEDGER_NOT_BUSINESS: 'LEDGER_NOT_BUSINESS',
  DEBT_NOT_FOUND: 'DEBT_NOT_FOUND',
  DEBT_CLOSED: 'DEBT_CLOSED',
  ENTRY_NOT_POSTED: 'ENTRY_NOT_POSTED',
  ENTRY_KIND_MISMATCH: 'ENTRY_KIND_MISMATCH',
  CONTACT_MISMATCH: 'CONTACT_MISMATCH',
  AMOUNT_EXCEEDS_BALANCE: 'AMOUNT_EXCEEDS_BALANCE',
  ENTRY_OVER_ALLOCATED: 'ENTRY_OVER_ALLOCATED',
} as const;
