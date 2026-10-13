import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DebtsService } from './debts.service.js';

const LEDGER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_LEDGER_ID = '12121212-1212-4121-8121-121212121212';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const MEMBER_ID = '23232323-2323-4232-8232-232323232323';
const DEBT_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_DEBT_ID = '34343434-3434-4343-8343-343434343434';
const ENTRY_ID = '44444444-4444-4444-8444-444444444444';
const CONTACT_ID = '55555555-5555-4555-8555-555555555555';
const SUPPLIER_ID = '56565656-5656-4565-8565-565656565656';
const FOREIGN_CONTACT_ID = '57575757-5757-4575-8575-575757575757';
const CURRENCY_ID = '66666666-6666-4666-8666-666666666666';
const FX_CURRENCY_ID = '67676767-6767-4676-8676-676767676767';

type DebtSeed = {
  id: string;
  ledgerId: string;
  contactId: string;
  direction: 'RECEIVABLE' | 'PAYABLE';
  status: string;
  sourceEntryId: string;
  description: string | null;
  businessDate: Date;
  originalAmount: Prisma.Decimal;
  settledAmount: Prisma.Decimal;
  currencyId: string;
  baseAmount: Prisma.Decimal;
  baseSettledAmount: Prisma.Decimal;
  baseCurrencyId: string;
  exchangeRate: Prisma.Decimal | null;
  dueDate: Date | null;
  settledAt: Date | null;
  writtenOffAt: Date | null;
  reversalOfId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeDebt(overrides: Partial<DebtSeed> = {}): DebtSeed {
  return {
    id: DEBT_ID,
    ledgerId: LEDGER_ID,
    contactId: CONTACT_ID,
    direction: 'RECEIVABLE',
    status: 'OPEN',
    sourceEntryId: ENTRY_ID,
    description: 'فاتورة آجلة',
    businessDate: new Date('2026-10-01T00:00:00.000Z'),
    originalAmount: new Prisma.Decimal('1000'),
    settledAmount: new Prisma.Decimal('0'),
    currencyId: CURRENCY_ID,
    baseAmount: new Prisma.Decimal('1000'),
    baseSettledAmount: new Prisma.Decimal('0'),
    baseCurrencyId: CURRENCY_ID,
    exchangeRate: null,
    dueDate: null,
    settledAt: null,
    writtenOffAt: null,
    reversalOfId: null,
    archivedAt: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

type EntrySeed = {
  id: string;
  ledgerId: string;
  sequenceNumber: number;
  kind: string;
  status: string;
  businessDate: Date;
  contactId: string | null;
  originalAmount: Prisma.Decimal | null;
  baseAmount: Prisma.Decimal;
};

function makeEntry(overrides: Partial<EntrySeed> = {}): EntrySeed {
  return {
    id: ENTRY_ID,
    ledgerId: LEDGER_ID,
    sequenceNumber: 2,
    kind: 'COLLECTION',
    status: 'POSTED',
    businessDate: new Date('2026-10-05T00:00:00.000Z'),
    contactId: CONTACT_ID,
    originalAmount: new Prisma.Decimal('1000'),
    baseAmount: new Prisma.Decimal('1000'),
    ...overrides,
  };
}

type AllocationSeed = {
  id: string;
  debtId: string;
  entryId: string;
  amount: Prisma.Decimal;
  baseAmount: Prisma.Decimal;
  allocatedAt: Date;
  reversalOfId: string | null;
};

function makeAllocation(overrides: Partial<AllocationSeed> = {}): AllocationSeed {
  return {
    id: '88888888-8888-4888-8888-888888888888',
    debtId: DEBT_ID,
    entryId: ENTRY_ID,
    amount: new Prisma.Decimal('1000'),
    baseAmount: new Prisma.Decimal('1000'),
    allocatedAt: new Date('2026-10-05T00:00:00.000Z'),
    reversalOfId: null,
    ...overrides,
  };
}

type ContactSeed = { id: string; ledgerId: string; name: string; kind: string; currencyId: string | null };

function makeContact(overrides: Partial<ContactSeed> = {}): ContactSeed {
  return {
    id: CONTACT_ID,
    ledgerId: LEDGER_ID,
    name: 'شركة الوفاء',
    kind: 'CUSTOMER',
    currencyId: null,
    ...overrides,
  };
}

type Options = {
  ledgerType?: string;
  ownerId?: string;
  memberPermissions?: { permission: string; revokedAt: Date | null }[];
  debts?: DebtSeed[];
  entries?: EntrySeed[];
  allocations?: AllocationSeed[];
  contacts?: ContactSeed[];
};

function makePrisma(options: Options = {}) {
  const state = {
    debts: [...(options.debts ?? [makeDebt()])],
    entries: [...(options.entries ?? [makeEntry()])],
    allocations: [...(options.allocations ?? [])],
    contacts: [
      makeContact(),
      makeContact({ id: SUPPLIER_ID, kind: 'SUPPLER', name: 'مورد الخير' }),
      makeContact({ id: FOREIGN_CONTACT_ID, ledgerId: OTHER_LEDGER_ID, name: 'عميل دفتر آخر' }),
      ...(options.contacts ?? []),
    ],
    audit: [] as Record<string, unknown>[],
  };

  const hydrate = (debt: DebtSeed) => ({
    ...debt,
    contact: state.contacts.find((c) => c.id === debt.contactId) ?? null,
    sourceEntry: state.entries.find((e) => e.id === debt.sourceEntryId) ?? null,
    allocations: state.allocations
      .filter((a) => a.debtId === debt.id)
      .map((a) => ({ ...a, entry: state.entries.find((e) => e.id === a.entryId) ?? null })),
  });

  const matches = (debt: DebtSeed, where: Record<string, unknown>): boolean => {
    if (where.ledgerId && debt.ledgerId !== where.ledgerId) return false;
    if (where.contactId && debt.contactId !== where.contactId) return false;
    if (where.status && debt.status !== where.status) return false;
    if (where.direction && debt.direction !== where.direction) return false;
    const range = where.businessDate as { gte?: Date; lte?: Date } | undefined;
    if (range?.gte && debt.businessDate.getTime() < range.gte.getTime()) return false;
    if (range?.lte && debt.businessDate.getTime() > range.lte.getTime()) return false;
    return true;
  };

  const prisma: any = {
    ledger: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id === LEDGER_ID) {
          return {
            id: LEDGER_ID,
            ownerId: options.ownerId ?? OWNER_ID,
            type: options.ledgerType ?? 'BUSINESS',
            baseCurrencyId: CURRENCY_ID,
          };
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
    debt: {
      findUnique: vi.fn(async ({ where }: any) => {
        const debt = state.debts.find((d) => d.id === where.id);
        return debt ? hydrate(debt) : null;
      }),
      findMany: vi.fn(async ({ where }: any) => state.debts.filter((d) => matches(d, where)).map(hydrate)),
    },
    journalEntry: {
      findUnique: vi.fn(async ({ where }: any) => state.entries.find((e) => e.id === where.id) ?? null),
    },
    debtAllocation: {
      findMany: vi.fn(async ({ where }: any) =>
        state.allocations.filter((a) => a.entryId === where.entryId),
      ),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: '99999999-9999-4999-8999-999999999999', allocatedAt: new Date(), ...data };
        state.allocations.push(row);
        return row;
      }),
    },
    contact: {
      findUnique: vi.fn(async ({ where }: any) => state.contacts.find((c) => c.id === where.id) ?? null),
    },
    transactionAuditLog: {
      create: vi.fn(async ({ data }: any) => {
        state.audit.push(data);
        return { id: '00000000-0000-4000-8000-000000000000', ...data };
      }),
    },
  };

  const update = vi.fn(async ({ where, data }: any) => {
    const debt = state.debts.find((d) => d.id === where.id);
    if (debt) Object.assign(debt, data);
    return debt;
  });
  (prisma as any).debt.update = update;
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));

  return { prisma, state };
}

function service(options: Options = {}) {
  const { prisma, state } = makePrisma(options);
  return { svc: new DebtsService(prisma as never), prisma, state };
}

describe('DebtsService access control', () => {
  it('rejects an unknown ledger', async () => {
    const { svc } = service();
    await expect(svc.list(OTHER_LEDGER_ID, OWNER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-member without the permission', async () => {
    const { svc } = service({ ownerId: MEMBER_ID, memberPermissions: [] });
    await expect(svc.list(LEDGER_ID, OWNER_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a member holding the required permission', async () => {
    const { svc } = service({
      ownerId: MEMBER_ID,
      memberPermissions: [{ permission: 'ENTRY_VIEW', revokedAt: null }],
    });
    await expect(svc.list(LEDGER_ID, OWNER_ID)).resolves.toBeInstanceOf(Array);
  });

  it('refuses debts on a HOUSEHOLD ledger even for the owner', async () => {
    const { svc } = service({ ledgerType: 'HOUSEHOLD' });
    await expect(svc.list(LEDGER_ID, OWNER_ID)).rejects.toThrow(/LEDGER_NOT_BUSINESS/);
  });
});

describe('DebtsService list and get', () => {
  it('lists debts with computed remaining amounts', async () => {
    const { svc } = service({
      debts: [makeDebt({ settledAmount: new Prisma.Decimal('400'), baseSettledAmount: new Prisma.Decimal('400'), status: 'PARTIALLY_SETTLED' })],
    });
    const [debt] = await svc.list(LEDGER_ID, OWNER_ID);
    expect(debt.originalAmount).toBe('1000.0000');
    expect(debt.settledAmount).toBe('400.0000');
    expect(debt.remainingAmount).toBe('600.0000');
    expect(debt.contact).toEqual({ id: CONTACT_ID, name: 'شركة الوفاء', kind: 'CUSTOMER' });
  });

  it('filters the list by status and direction', async () => {
    const { svc } = service({
      debts: [makeDebt(), makeDebt({ id: OTHER_DEBT_ID, direction: 'PAYABLE', status: 'SETTLED' })],
    });
    const open = await svc.list(LEDGER_ID, OWNER_ID, { status: 'OPEN' } as never);
    expect(open).toHaveLength(1);
    const payable = await svc.list(LEDGER_ID, OWNER_ID, { direction: 'PAYABLE' } as never);
    expect(payable).toHaveLength(1);
    expect(payable[0].direction).toBe('PAYABLE');
  });

  it('answers 404 for a debt in another ledger', async () => {
    const { svc } = service({ debts: [makeDebt({ ledgerId: OTHER_LEDGER_ID })] });
    await expect(svc.get(LEDGER_ID, DEBT_ID, OWNER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers 404 for an unknown debt', async () => {
    const { svc } = service({ debts: [] });
    await expect(svc.get(LEDGER_ID, DEBT_ID, OWNER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DebtsService allocate', () => {
  it('settles a receivable fully and marks it SETTLED', async () => {
    const { svc, prisma, state } = service();
    const result = await svc.allocate(LEDGER_ID, DEBT_ID, OWNER_ID, { entryId: ENTRY_ID, amount: '1000' } as never);
    expect(prisma.debtAllocation.create).toHaveBeenCalledTimes(1);
    expect(state.debts[0].status).toBe('SETTLED');
    expect(state.debts[0].settledAt).toBeInstanceOf(Date);
    expect(result.debt.remainingAmount).toBe('0.0000');
    expect(state.audit).toHaveLength(1);
  });

  it('records a partial settlement as PARTIALLY_SETTLED', async () => {
    const { svc, state } = service();
    await svc.allocate(LEDGER_ID, DEBT_ID, OWNER_ID, { entryId: ENTRY_ID, amount: '250' } as never);
    expect(state.debts[0].status).toBe('PARTIALLY_SETTLED');
    expect(state.debts[0].settledAt).toBeNull();
    expect((state.debts[0].settledAmount as Prisma.Decimal).toFixed(4)).toBe('250.0000');
  });

  it('rejects a zero or negative amount', async () => {
    const { svc } = service();
    await expect(
      svc.allocate(LEDGER_ID, DEBT_ID, OWNER_ID, { entryId: ENTRY_ID, amount: '0' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.allocate(LEDGER_ID, DEBT_ID, OWNER_ID, { entryId: ENTRY_ID, amount: '-5' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an amount greater than the remaining balance', async () => {
    const { svc } = service();
    await expect(
      svc.allocate(LEDGER_ID, DEBT_ID, OWNER_ID, { entryId: ENTRY_ID, amount: '1000.01' } as never),
    ).rejects.toThrow(/AMOUNT_EXCEEDS_BALANCE/);
  });

  it('rejects a settlement on a clearly closed debt', async () => {
    const { svc } = service({ debts: [makeDebt({ status: 'WRITTEN_OFF' })] });
    await expect(
      svc.allocate(LEDGER_ID, DEBT_ID, OWNER_ID, { entryId: ENTRY_ID, amount: '10' } as never),
    ).rejects.toThrow(/DEBT_CLOSED/);
  });

  it('rejects an entry that is not POSTED', async () => {
    const { svc } = service({ entries: [makeEntry({ status: 'DRAFT' })] });
    await expect(
      svc.allocate(LEDGER_ID, DEBT_ID, OWNER_ID, { entryId: ENTRY_ID, amount: '10' } as never),
    ).rejects.toThrow(/ENTRY_NOT_POSTED/);
  });

  it('rejects a settlement whose entry kind does not match the debt direction', async () => {
    const { svc } = service({ entries: [makeEntry({ kind: 'PAYMENT' })] });
    await expect(
      svc.allocate(LEDGER_ID, DEBT_ID, OWNER_ID, { entryId: ENTRY_ID, amount: '10' } as never),
    ).rejects.toThrow(/ENTRY_KIND_MISMATCH/);
  });

  it('rejects an entry belonging to another contact', async () => {
    const { svc } = service({ entries: [makeEntry({ contactId: SUPPLIER_ID })] });
    await expect(
      svc.allocate(LEDGER_ID, DEBT_ID, OWNER_ID, { entryId: ENTRY_ID, amount: '10' } as never),
    ).rejects.toThrow(/CONTACT_MISMATCH/);
  });

  it('rejects an entry from another ledger', async () => {
    const { svc } = service({ entries: [makeEntry({ ledgerId: OTHER_LEDGER_ID })] });
    await expect(
      svc.allocate(LEDGER_ID, DEBT_ID, OWNER_ID, { entryId: ENTRY_ID, amount: '10' } as never),
    ).rejects.toThrow(/ENTRY_NOT_POSTED/);
  });

  it('rejects over-allocating a single entry across debts', async () => {
    const otherDebt = makeDebt({ id: OTHER_DEBT_ID, originalAmount: new Prisma.Decimal('1000'), baseAmount: new Prisma.Decimal('1000') });
    const { svc } = service({
      debts: [makeDebt(), otherDebt],
      allocations: [makeAllocation({ debtId: OTHER_DEBT_ID, amount: new Prisma.Decimal('900'), baseAmount: new Prisma.Decimal('900') })],
    });
    await expect(
      svc.allocate(LEDGER_ID, DEBT_ID, OWNER_ID, { entryId: ENTRY_ID, amount: '200' } as never),
    ).rejects.toThrow(/ENTRY_OVER_ALLOCATED/);
  });

  it('derives the base amount from the debt ratio across currencies', async () => {
    const fxDebt = makeDebt({
      currencyId: FX_CURRENCY_ID,
      baseCurrencyId: CURRENCY_ID,
      originalAmount: new Prisma.Decimal('100'),
      baseAmount: new Prisma.Decimal('130000'),
      exchangeRate: new Prisma.Decimal('1300'),
    });
    const fxEntry = makeEntry({ originalAmount: new Prisma.Decimal('40'), baseAmount: new Prisma.Decimal('52000') });
    const { svc, prisma } = service({ debts: [fxDebt], entries: [fxEntry] });
    await svc.allocate(LEDGER_ID, DEBT_ID, OWNER_ID, { entryId: ENTRY_ID, amount: '40' } as never);
    expect(prisma.debtAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ baseAmount: expect.anything() }) }),
    );
    const created = prisma.debtAllocation.create.mock.calls[0][0].data;
    expect(created.baseAmount.toFixed(4)).toBe('52000.0000');
  });

  it('requires ENTRY_CREATE to allocate', async () => {
    const { svc } = service({ ownerId: MEMBER_ID, memberPermissions: [{ permission: 'ENTRY_VIEW', revokedAt: null }] });
    await expect(
      svc.allocate(LEDGER_ID, DEBT_ID, OWNER_ID, { entryId: ENTRY_ID, amount: '10' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('DebtsService statement', () => {
  it('summarizes original, settled and remaining totals', async () => {
    const { svc } = service({
      debts: [makeDebt({ settledAmount: new Prisma.Decimal('300'), baseSettledAmount: new Prisma.Decimal('300'), status: 'PARTIALLY_SETTLED' })],
    });
    const statement = await svc.statement(LEDGER_ID, CONTACT_ID, OWNER_ID);
    expect(statement.totals).toEqual({
      originalBase: '1000.0000',
      settledBase: '300.0000',
      remainingBase: '700.0000',
    });
    expect(statement.contact).toEqual({ id: CONTACT_ID, name: 'شركة الوفاء', kind: 'CUSTOMER', currencyId: null });
    expect(statement.debts).toHaveLength(1);
  });

  it('filters movements by the from/to window', async () => {
    const inRange = makeAllocation({ id: 'abababab-abab-4aba-8aba-abababababab' });
    const outOfRange = makeAllocation({
      id: 'acacacac-acac-4aca-8aca-acacacacacac',
      entryId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    });
    const entry = makeEntry({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', businessDate: new Date('2026-12-31T00:00:00.000Z') });
    const { svc } = service({ entries: [makeEntry(), entry], allocations: [inRange, outOfRange] });
    const statement = await svc.statement(LEDGER_ID, CONTACT_ID, OWNER_ID, {
      from: '2026-10-01',
      to: '2026-10-31',
    } as never);
    expect(statement.debts[0].allocations).toHaveLength(1);
    expect(statement.range).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('excludes allocations whose entry is not POSTED', async () => {
    const { svc } = service({
      entries: [makeEntry({ status: 'DRAFT' })],
      allocations: [makeAllocation()],
    });
    const statement = await svc.statement(LEDGER_ID, CONTACT_ID, OWNER_ID);
    expect(statement.debts[0].allocations).toHaveLength(0);
  });

  it('rejects a contact from another ledger', async () => {
    const { svc } = service();
    await expect(svc.statement(LEDGER_ID, FOREIGN_CONTACT_ID, OWNER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inverted date range', async () => {
    const { svc } = service();
    await expect(
      svc.statement(LEDGER_ID, CONTACT_ID, OWNER_ID, { from: '2026-10-31', to: '2026-10-01' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires CONTACT_VIEW to read a statement', async () => {
    const { svc } = service({ ownerId: MEMBER_ID, memberPermissions: [{ permission: 'ENTRY_VIEW', revokedAt: null }] });
    await expect(svc.statement(LEDGER_ID, CONTACT_ID, OWNER_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
