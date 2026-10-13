import type { ContactKind, LineDirection } from '@prisma/client';

/**
 * Vocabularies mirrored from `prisma/schema.prisma` as literal tuples, so the
 * DTOs and the service validate against one source without casting through
 * `any`. The schema keeps the historical `SUPPLER` spelling internally; the
 * public API never sees it.
 */

export const DRAFT_KINDS = [
  'INCOME',
  'EXPENSE',
  'SALE_CASH',
  'SALE_CREDIT',
  'PURCHASE_CASH',
  'PURCHASE_CREDIT',
  'COLLECTION',
  'PAYMENT',
  'TRANSFER',
] as const;

export type DraftKind = (typeof DRAFT_KINDS)[number];

export const SALE_KINDS = ['SALE_CASH', 'SALE_CREDIT'] as const;

export const PURCHASE_KINDS = ['PURCHASE_CASH', 'PURCHASE_CREDIT'] as const;

export const COMMERCIAL_KINDS = ['SALE_CASH', 'SALE_CREDIT', 'PURCHASE_CASH', 'PURCHASE_CREDIT'] as const;

/** `SALE_CREDIT`/`PURCHASE_CREDIT` open a debt; the credit kinds that need a contact. */
export const CREDIT_KINDS = ['SALE_CREDIT', 'PURCHASE_CREDIT'] as const;

/** Settlement kinds: a collection from a customer or a payment to a supplier. */
export const SETTLEMENT_KINDS = ['COLLECTION', 'PAYMENT'] as const;

/** Kinds that open a `Debt` when posted. */
export const DEBT_OPENING_KINDS = ['SALE_CREDIT', 'PURCHASE_CREDIT'] as const;

/** Kinds allowed only on a `BUSINESS` ledger. `TRANSFER` is intentionally excluded. */
export const BUSINESS_KINDS = [
  'SALE_CASH',
  'SALE_CREDIT',
  'PURCHASE_CASH',
  'PURCHASE_CREDIT',
  'COLLECTION',
  'PAYMENT',
] as const;

/** Check if kind is a transfer between two accounts. */
export function isTransferKind(kind: string): boolean {
  return kind === 'TRANSFER';
}

const DRAFT_SET = new Set<string>(DRAFT_KINDS);
const SALE_SET = new Set<string>(SALE_KINDS);
const PURCHASE_SET = new Set<string>(PURCHASE_KINDS);
const BUSINESS_SET = new Set<string>(BUSINESS_KINDS);
const CREDIT_SET = new Set<string>(CREDIT_KINDS);
const SETTLEMENT_SET = new Set<string>(SETTLEMENT_KINDS);
const DEBT_OPENING_SET = new Set<string>(DEBT_OPENING_KINDS);

export function isDraftKind(kind: string): kind is DraftKind {
  return DRAFT_SET.has(kind);
}

export function isCommercialKind(kind: string): boolean {
  return SALE_SET.has(kind) || PURCHASE_SET.has(kind);
}

/** Sale/purchase and settlement kinds belong to a `BUSINESS` ledger. */
export function isBusinessKind(kind: string): boolean {
  return BUSINESS_SET.has(kind);
}

export function isCreditKind(kind: string): boolean {
  return CREDIT_SET.has(kind);
}

export function isSettlementKind(kind: string): boolean {
  return SETTLEMENT_SET.has(kind);
}

export function isDebtOpeningKind(kind: string): boolean {
  return DEBT_OPENING_SET.has(kind);
}

/** Sale/collection and plain `INCOME` credit the account; everything else debits it. */
export function isIncomeKind(kind: string): boolean {
  return kind === 'INCOME' || SALE_SET.has(kind) || kind === 'COLLECTION';
}

/**
 * The contact kind an operation must be linked to, or `null` when a contact is
 * optional. Credit sales and collections need a customer, credit purchases and
 * payments a supplier. Cash kinds accept an optional contact.
 */
export function requiredContactKind(kind: string): ContactKind | null {
  if (kind === 'SALE_CREDIT' || kind === 'COLLECTION') return 'CUSTOMER';
  if (kind === 'PURCHASE_CREDIT' || kind === 'PAYMENT') return 'SUPPLER';
  return null;
}

export function entryDirection(kind: string): LineDirection {
  return isIncomeKind(kind) ? 'CREDIT' : 'DEBIT';
}

/**
 * The `Debt` direction a credit kind opens, or `null` for kinds that do not
 * open a debt. A credit sale is money owed to us; a credit purchase is owed by us.
 */
export function debtDirectionForKind(kind: string): 'RECEIVABLE' | 'PAYABLE' | null {
  if (kind === 'SALE_CREDIT') return 'RECEIVABLE';
  if (kind === 'PURCHASE_CREDIT') return 'PAYABLE';
  return null;
}

export const KIND_LABEL_AR: Record<string, string> = {
  INCOME: 'وارد',
  EXPENSE: 'صادر',
  SALE_CASH: 'بيع نقدي',
  SALE_CREDIT: 'بيع آجل',
  PURCHASE_CASH: 'شراء نقدي',
  PURCHASE_CREDIT: 'شراء آجل',
  COLLECTION: 'تحصيل',
  PAYMENT: 'دفع',
  TRANSFER: 'تحويل',
};