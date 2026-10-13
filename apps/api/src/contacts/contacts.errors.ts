/** Rejections carry a stable code so clients can branch without parsing prose. */
export const CONTACT_ERROR_CODES = {
  /** Contacts exist only for the BUSINESS ledger, mirroring TASK-021's scope. */
  LEDGER_NOT_BUSINESS: 'LEDGER_NOT_BUSINESS',
  /** An archived contact is read-only; archiving never deletes. */
  ARCHIVED: 'CONTACT_ARCHIVED',
} as const;

export type ContactErrorCode = (typeof CONTACT_ERROR_CODES)[keyof typeof CONTACT_ERROR_CODES];