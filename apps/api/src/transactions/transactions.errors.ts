/**
 * Stable error codes for commercial transactions. They are prefixed to the
 * Arabic message (`CODE: رسالة`) because responses stay text-only in this API.
 */
export const TRANSACTION_ERROR_CODES = {
  LEDGER_NOT_BUSINESS: 'LEDGER_NOT_BUSINESS',
  CONTACT_REQUIRED: 'CONTACT_REQUIRED',
  CONTACT_KIND_MISMATCH: 'CONTACT_KIND_MISMATCH',
  CONTACT_ARCHIVED: 'CONTACT_ARCHIVED',
  INVALID_KIND: 'INVALID_KIND',
} as const;
