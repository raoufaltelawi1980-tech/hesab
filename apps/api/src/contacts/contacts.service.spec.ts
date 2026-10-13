import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactsService } from './contacts.service.js';

const LEDGER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_LEDGER_ID = '22222222-2222-4222-8222-222222222222';
const MISSING_LEDGER_ID = '99999999-9999-4999-8999-999999999999';
const OWNER_ID = '33333333-3333-4333-8333-333333333333';
const MEMBER_ID = '44444444-4444-4444-8444-444444444444';
const CONTACT_ID = '55555555-5555-4555-8555-555555555555';
const OTHER_CONTACT_ID = '66666666-6666-4666-8666-666666666666';
const CURRENCY_ID = '77777777-7777-4777-8777-777777777777';
const UNKNOWN_CURRENCY_ID = '88888888-8888-4888-8888-888888888888';

type ContactRow = {
  id: string;
  ledgerId: string;
  kind: string;
  name: string;
  email: string | null;
  phone: string | null;
  taxNumber: string | null;
  currencyId: string | null;
  creditLimit: Prisma.Decimal | null;
  notes: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeContact(overrides: Partial<ContactRow> = {}): ContactRow {
  return {
    id: CONTACT_ID,
    ledgerId: LEDGER_ID,
    kind: 'CUSTOMER',
    name: 'شركة الوفاء',
    email: null,
    phone: null,
    taxNumber: null,
    currencyId: CURRENCY_ID,
    creditLimit: null,
    notes: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

type Options = {
  ledgerType?: string;
  contacts?: ContactRow[];
  memberPermissions?: { permission: string; revokedAt: Date | null }[];
};

function makePrisma(options: Options = {}) {
  const ledgerType = options.ledgerType ?? 'BUSINESS';
  const state = { contacts: [...(options.contacts ?? [])] };

  const prisma = {
    ledger: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id === LEDGER_ID || where.id === OTHER_LEDGER_ID) {
          return { id: where.id, ownerId: OWNER_ID, type: ledgerType, baseCurrencyId: CURRENCY_ID };
        }
        return null;
      }),
    },
    ledgerMember: {
      findUnique: vi.fn(async () =>
        options.memberPermissions
          ? { ledgerId: LEDGER_ID, userId: MEMBER_ID, permissions: options.memberPermissions }
          : null,
      ),
    },
    currency: {
      findUnique: vi.fn(async ({ where }: any) =>
        where.id === CURRENCY_ID ? { id: CURRENCY_ID, code: 'IQD' } : null,
      ),
    },
    contact: {
      findMany: vi.fn(async ({ where }: any) =>
        state.contacts.filter((row) => {
          if (where.ledgerId && row.ledgerId !== where.ledgerId) return false;
          if (where.kind && row.kind !== where.kind) return false;
          if ('archivedAt' in where && where.archivedAt === null && row.archivedAt !== null) return false;
          return true;
        }),
      ),
      findUnique: vi.fn(async ({ where }: any) =>
        state.contacts.find((row) => row.id === where.id) ?? null,
      ),
      create: vi.fn(async ({ data }: any) => {
        const row = makeContact({ ...data, id: CONTACT_ID, createdAt: new Date(), updatedAt: new Date() });
        state.contacts.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.contacts.find((contact) => contact.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
  };

  return { prisma, state };
}

function service(options: Options = {}) {
  const { prisma, state } = makePrisma(options);
  return { svc: new ContactsService(prisma as never), prisma, state };
}

function dto(overrides: Record<string, unknown> = {}) {
  return { kind: 'CUSTOMER', name: 'شركة الوفاء', ...overrides } as never;
}

describe('ContactsService gating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a malformed ledger id before touching the database', async () => {
    const { svc, prisma } = service();
    await expect(svc.list('not-a-uuid', OWNER_ID)).rejects.toThrow('معرّف الدفتر غير صالح');
    expect(prisma.ledger.findUnique).not.toHaveBeenCalled();
  });

  it('answers a missing ledger', async () => {
    const { svc } = service();
    await expect(svc.list(MISSING_LEDGER_ID, OWNER_ID)).rejects.toThrow('الدفتر غير موجود');
  });

  it('rejects a non-member with no permissions', async () => {
    const { svc } = service();
    await expect(svc.list(LEDGER_ID, MEMBER_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('grants CONTACT_VIEW without granting CONTACT_MANAGE', async () => {
    const { svc } = service({
      contacts: [makeContact()],
      memberPermissions: [{ permission: 'CONTACT_VIEW', revokedAt: null }],
    });
    await expect(svc.list(LEDGER_ID, MEMBER_ID)).resolves.toHaveLength(1);
    await expect(svc.create(LEDGER_ID, MEMBER_ID, dto())).rejects.toThrow('لا تملك صلاحية تنفيذ هذه العملية');
  });

  it('refuses a HOUSEHOLD ledger with the LEDGER_NOT_BUSINESS code', async () => {
    const { svc } = service({ ledgerType: 'HOUSEHOLD' });
    const failure = svc.list(LEDGER_ID, OWNER_ID);
    await expect(failure).rejects.toBeInstanceOf(ForbiddenException);
    await expect(failure).rejects.toThrow(/LEDGER_NOT_BUSINESS/);
  });

  it('checks the permission before the ledger type, so a stranger learns nothing', async () => {
    const { svc } = service({ ledgerType: 'HOUSEHOLD', memberPermissions: [] });
    const failure = svc.list(LEDGER_ID, MEMBER_ID);
    await expect(failure).rejects.toThrow('لا تملك صلاحية تنفيذ هذه العملية');
    await expect(failure).rejects.not.toThrow(/LEDGER_NOT_BUSINESS/);
  });

  it('does not leak a contact that belongs to another ledger', async () => {
    const { svc } = service({ contacts: [makeContact({ ledgerId: OTHER_LEDGER_ID })] });
    await expect(svc.get(LEDGER_ID, CONTACT_ID, OWNER_ID)).rejects.toThrow('جهة الاتصال غير موجودة');
  });
});

describe('ContactsService create', () => {
  it('trims the name and maps the public SUPPLIER spelling to the schema enum', async () => {
    const { svc, prisma } = service();
    const created = await svc.create(LEDGER_ID, OWNER_ID, dto({ kind: 'SUPPLIER', name: '  مورد الخير  ' }));
    expect(prisma.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'SUPPLER', name: 'مورد الخير' }) }),
    );
    expect(created.kind).toBe('SUPPLIER');
  });

  it('defaults the settlement currency to the ledger base currency', async () => {
    const { svc, prisma } = service();
    await svc.create(LEDGER_ID, OWNER_ID, dto());
    expect(prisma.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currencyId: CURRENCY_ID }) }),
    );
  });

  it('validates an explicit currency', async () => {
    const { svc } = service();
    await expect(
      svc.create(LEDGER_ID, OWNER_ID, dto({ currencyId: UNKNOWN_CURRENCY_ID })),
    ).rejects.toThrow('العملة غير صالحة');
  });

  it('rejects an unknown kind', async () => {
    const { svc } = service();
    await expect(svc.create(LEDGER_ID, OWNER_ID, dto({ kind: 'PARTNER' }))).rejects.toThrow('kind غير صالح');
  });

  it('rejects a blank name', async () => {
    const { svc } = service();
    await expect(svc.create(LEDGER_ID, OWNER_ID, dto({ name: '   ' }))).rejects.toThrow(
      'name يجب أن يكون بين 1 و 200 حرفًا',
    );
  });

  it('rejects a malformed email', async () => {
    const { svc } = service();
    await expect(svc.create(LEDGER_ID, OWNER_ID, dto({ email: 'not-an-email' }))).rejects.toThrow('email غير صالح');
  });

  it('rejects a negative credit limit but accepts zero', async () => {
    const { svc } = service();
    await expect(svc.create(LEDGER_ID, OWNER_ID, dto({ creditLimit: '-1' }))).rejects.toThrow(
      'creditLimit يجب أن يكون صفرًا أو أكبر',
    );
    const created = await svc.create(LEDGER_ID, OWNER_ID, dto({ creditLimit: '0' }));
    expect(created.creditLimit).toBe('0.0000');
  });
});

describe('ContactsService list', () => {
  it('hides archived contacts by default and shows them on request', async () => {
    const { svc } = service({
      contacts: [makeContact(), makeContact({ id: OTHER_CONTACT_ID, archivedAt: new Date() })],
    });
    await expect(svc.list(LEDGER_ID, OWNER_ID)).resolves.toHaveLength(1);
    await expect(svc.list(LEDGER_ID, OWNER_ID, { includeArchived: 'true' })).resolves.toHaveLength(2);
  });

  it('filters by kind and serialises SUPPLER back to SUPPLIER', async () => {
    const { svc } = service({
      contacts: [makeContact(), makeContact({ id: OTHER_CONTACT_ID, kind: 'SUPPLER', name: 'مورد' })],
    });
    const suppliers = await svc.list(LEDGER_ID, OWNER_ID, { kind: 'SUPPLIER' });
    expect(suppliers).toHaveLength(1);
    expect(suppliers[0].kind).toBe('SUPPLIER');
  });

  it('scopes the list to the ledger', async () => {
    const { svc } = service({ contacts: [makeContact({ ledgerId: OTHER_LEDGER_ID })] });
    await expect(svc.list(LEDGER_ID, OWNER_ID)).resolves.toHaveLength(0);
  });
});

describe('ContactsService update and archive', () => {
  it('updates the mutable descriptive fields', async () => {
    const { svc, prisma } = service({ contacts: [makeContact()] });
    const updated = await svc.update(LEDGER_ID, CONTACT_ID, OWNER_ID, {
      name: 'اسم جديد',
      phone: '0770',
      creditLimit: '5000',
    });
    expect(updated.name).toBe('اسم جديد');
    expect(updated.phone).toBe('0770');
    expect(updated.creditLimit).toBe('5000.0000');
    expect(prisma.contact.update).toHaveBeenCalledWith({
      where: { id: CONTACT_ID },
      data: { name: 'اسم جديد', phone: '0770', creditLimit: expect.any(Prisma.Decimal) },
    });
  });

  it('clears an optional field sent as empty', async () => {
    const { svc } = service({ contacts: [makeContact({ phone: '0770' })] });
    const updated = await svc.update(LEDGER_ID, CONTACT_ID, OWNER_ID, { phone: '  ' });
    expect(updated.phone).toBeNull();
  });

  it('refuses to modify an archived contact', async () => {
    const { svc } = service({ contacts: [makeContact({ archivedAt: new Date() })] });
    await expect(svc.update(LEDGER_ID, CONTACT_ID, OWNER_ID, { name: 'x' })).rejects.toThrow(/CONTACT_ARCHIVED/);
  });

  it('archives without deleting and refuses to archive twice', async () => {
    const { svc, prisma } = service({ contacts: [makeContact()] });
    const result = await svc.archive(LEDGER_ID, CONTACT_ID, OWNER_ID);
    expect(result.message).toBe('تم أرشفة جهة الاتصال');
    expect(result.contact.archivedAt).not.toBeNull();
    expect(prisma.contact.update).toHaveBeenCalledWith({
      where: { id: CONTACT_ID },
      data: { archivedAt: expect.any(Date) },
    });
    expect('delete' in prisma.contact).toBe(false);

    const again = service({ contacts: [makeContact({ archivedAt: new Date() })] });
    await expect(again.svc.archive(LEDGER_ID, CONTACT_ID, OWNER_ID)).rejects.toThrow(/CONTACT_ARCHIVED/);
  });
});