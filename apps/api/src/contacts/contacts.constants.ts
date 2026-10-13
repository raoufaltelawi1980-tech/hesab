import type { ContactKind } from '@prisma/client';

/**
 * Public vocabulary for `Contact.kind`, mirroring `API_CONTRACTS.md` section 13.1.
 *
 * The schema's `ContactKind` enum spells the supplier member `SUPPLER`, while
 * the public contract spells it `SUPPLIER`. The service maps between the two at
 * the boundary, so the API follows the contract without a schema change.
 */
export const CONTACT_KINDS = ['CUSTOMER', 'SUPPLIER'] as const;
export type ContactKindInput = (typeof CONTACT_KINDS)[number];

/** The value actually stored in `contacts.kind` for a supplier. */
export const SUPPLIER_DB_KIND: ContactKind = 'SUPPLER';