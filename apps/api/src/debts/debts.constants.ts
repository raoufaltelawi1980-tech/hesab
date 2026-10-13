import type { DebtDirection } from '@prisma/client';

/**
 * Vocabularies mirrored from `prisma/schema.prisma` as literal tuples, so the
 * service can narrow `string` inputs without casting through `any`.
 */

export const DEBT_STATUSES = ['OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'WRITTEN_OFF', 'REVERSED'] as const;
export type DebtStatusLiteral = (typeof DEBT_STATUSES)[number];

export const DEBT_DIRECTIONS = ['RECEIVABLE', 'PAYABLE'] as const;

/** A debt still accepts allocations only while it has an outstanding balance. */
export const SETTLEABLE_STATUSES: readonly DebtStatusLiteral[] = ['OPEN', 'PARTIALLY_SETTLED'];

/** The settlement entry kind that may settle each debt direction. */
export const SETTLEMENT_KIND_BY_DIRECTION: Record<DebtDirection, 'COLLECTION' | 'PAYMENT'> = {
  RECEIVABLE: 'COLLECTION',
  PAYABLE: 'PAYMENT',
};

/** The contact kind each debt direction must be attached to. */
export const CONTACT_KIND_BY_DIRECTION: Record<DebtDirection, 'CUSTOMER' | 'SUPPLER'> = {
  RECEIVABLE: 'CUSTOMER',
  PAYABLE: 'SUPPLER',
};
