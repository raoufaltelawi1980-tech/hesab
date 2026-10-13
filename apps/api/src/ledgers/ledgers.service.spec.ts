import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LedgersService } from './ledgers.service.js';
import type { UpdateLedgerSettingsDto } from './dto/update-ledger-settings.dto.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const NON_MEMBER = '33333333-3333-4333-8333-333333333333';
const ANOTHER_OWNER = '44444444-4444-4444-8444-444444444444';

const LEDGER_OWNED = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LEDGER_MEMBERED_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LEDGER_MEMBERED_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const LEDGER_SUSPENDED = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const UNKNOWN_LEDGER = '99999999-9999-4999-8999-999999999999';

type LedgerRow = {
  id: string;
  type: string;
  name: string;
  ownerId: string;
  baseCurrencyId: string;
  currencyCode: string;
  createdAt: Date;
};

type MemberRow = {
  id: string;
  ledgerId: string;
  userId: string;
  status: string;
  archivedAt: Date | null;
  createdAt: Date;
};

type PermRow = {
  id: string;
  memberId: string;
  permission: string;
  revokedAt: Date | null;
};

const day = (n: number) => new Date(2026, 0, n);

const LEDGERS: LedgerRow[] = [
  { id: LEDGER_OWNED, type: 'HOUSEHOLD', name: 'دفتر المالك', ownerId: OWNER, baseCurrencyId: 'cur-iqd', currencyCode: 'IQD', createdAt: day(4) },
  { id: LEDGER_MEMBERED_A, type: 'BUSINESS', name: 'دفتر الشركة', ownerId: ANOTHER_OWNER, baseCurrencyId: 'cur-iqd', currencyCode: 'IQD', createdAt: day(3) },
  { id: LEDGER_MEMBERED_B, type: 'HOUSEHOLD', name: 'دفتر ثانٍ', ownerId: ANOTHER_OWNER, baseCurrencyId: 'cur-usd', currencyCode: 'USD', createdAt: day(2) },
  { id: LEDGER_SUSPENDED, type: 'HOUSEHOLD', name: 'دفتر موقوف', ownerId: ANOTHER_OWNER, baseCurrencyId: 'cur-iqd', currencyCode: 'IQD', createdAt: day(1) },
];

const MEMBERS: MemberRow[] = [
  { id: 'm-a', ledgerId: LEDGER_MEMBERED_A, userId: MEMBER, status: 'ACTIVE', archivedAt: null, createdAt: day(3) },
  { id: 'm-b', ledgerId: LEDGER_MEMBERED_B, userId: MEMBER, status: 'ACTIVE', archivedAt: null, createdAt: day(2) },
  { id: 'm-susp', ledgerId: LEDGER_SUSPENDED, userId: MEMBER, status: 'SUSPENDED', archivedAt: day(1), createdAt: day(1) },
];

const PERMISSIONS: PermRow[] = [
  { id: 'p1', memberId: 'm-a', permission: 'ENTRY_VIEW', revokedAt: null },
  { id: 'p2', memberId: 'm-b', permission: 'BUDGET_VIEW', revokedAt: null },
  { id: 'p3', memberId: 'm-b', permission: 'REPORT_VIEW', revokedAt: day(1) },
];

function withCurrency(row: LedgerRow) {
  const { currencyCode, ...rest } = row;
  return { ...rest, baseCurrency: { id: row.baseCurrencyId, code: currencyCode } };
}

function makePrisma() {
  return {
    ledger: {
      findMany: vi.fn(async ({ where }: { where: { ownerId: string } }) =>
        LEDGERS.filter((row) => row.ownerId === where.ownerId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map(withCurrency),
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = LEDGERS.find((ledger) => ledger.id === where.id);
        return row ? withCurrency(row) : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = LEDGERS.find((ledger) => ledger.id === where.id)!;
        return { ...row, ...data };
      }),
    },
    ledgerMember: {
      findMany: vi.fn(
        async ({ where }: { where: { userId: string; status: string; archivedAt: null } }) =>
          MEMBERS.filter(
            (member) =>
              member.userId === where.userId &&
              member.status === where.status &&
              member.archivedAt === where.archivedAt,
          )
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((member) => ({
              ...member,
              ledger: withCurrency(LEDGERS.find((ledger) => ledger.id === member.ledgerId)!),
              permissions: PERMISSIONS.filter((permission) => permission.memberId === member.id),
            })),
      ),
      findUnique: vi.fn(
        async ({ where }: { where: { ledgerId_userId: { ledgerId: string; userId: string } } }) => {
          const { ledgerId, userId } = where.ledgerId_userId;
          const member = MEMBERS.find((row) => row.ledgerId === ledgerId && row.userId === userId);
          if (!member) return null;
          return {
            ...member,
            permissions: PERMISSIONS.filter((permission) => permission.memberId === member.id),
          };
        },
      ),
    },
  };
}

function service() {
  const prisma = makePrisma();
  return { svc: new LedgersService(prisma as never), prisma };
}

describe('LedgersService access', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists only owned ledgers for the owner, tagged OWNER with full permissions', async () => {
    const { svc } = service();
    const ledgers = await svc.list(OWNER);
    expect(ledgers).toHaveLength(1);
    expect(ledgers[0].id).toBe(LEDGER_OWNED);
    expect(ledgers[0].role).toBe('OWNER');
    expect(ledgers[0].permissions).toContain('ENTRY_POST');
    expect(ledgers[0].permissions).toContain('LEDGER_MANAGE');
    expect(ledgers[0].baseCurrency?.code).toBe('IQD');
  });

  it('lists the ledgers where the user is an active member, tagged MEMBER', async () => {
    const { svc } = service();
    const ledgers = await svc.list(MEMBER);
    expect(ledgers.map((ledger) => ledger.id).sort()).toEqual([LEDGER_MEMBERED_A, LEDGER_MEMBERED_B].sort());
    expect(ledgers.every((ledger) => ledger.role === 'MEMBER')).toBe(true);
  });

  it('returns each membership its own live permissions', async () => {
    const { svc } = service();
    const ledgers = await svc.list(MEMBER);
    const a = ledgers.find((ledger) => ledger.id === LEDGER_MEMBERED_A)!;
    const b = ledgers.find((ledger) => ledger.id === LEDGER_MEMBERED_B)!;
    expect(a.permissions).toEqual(['ENTRY_VIEW']);
    expect(b.permissions).toEqual(['BUDGET_VIEW']);
  });

  it('hides a suspended membership from the list', async () => {
    const { svc } = service();
    const ledgers = await svc.list(MEMBER);
    expect(ledgers.some((ledger) => ledger.id === LEDGER_SUSPENDED)).toBe(false);
  });

  it('lists nothing for a non-member that owns nothing', async () => {
    const { svc } = service();
    expect(await svc.list(NON_MEMBER)).toEqual([]);
  });

  it('lets the owner open their ledger with full permissions', async () => {
    const { svc } = service();
    const ledger = await svc.get(LEDGER_OWNED, OWNER);
    expect(ledger.role).toBe('OWNER');
    expect(ledger.permissions).toContain('MEMBER_MANAGE');
  });

  it('lets an active member open the ledger with their live permissions', async () => {
    const { svc } = service();
    const ledger = await svc.get(LEDGER_MEMBERED_A, MEMBER);
    expect(ledger.role).toBe('MEMBER');
    expect(ledger.permissions).toEqual(['ENTRY_VIEW']);
  });

  it('rejects a suspended member with a 404 (no leak)', async () => {
    const { svc } = service();
    await expect(svc.get(LEDGER_SUSPENDED, MEMBER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a non-member with a 404 and does not reveal the ledger', async () => {
    const { svc } = service();
    await expect(svc.get(LEDGER_MEMBERED_A, NON_MEMBER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('isolates a user from another user’s ledger', async () => {
    const { svc } = service();
    await expect(svc.get(LEDGER_MEMBERED_A, OWNER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 for an unknown ledger id', async () => {
    const { svc } = service();
    await expect(svc.get(UNKNOWN_LEDGER, OWNER)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('LedgersService updateSettings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies only the whitelisted settings fields', async () => {
    const { svc, prisma } = service();
    await svc.updateSettings(LEDGER_OWNED, OWNER, { name: 'اسم جديد', budgetsEnabled: true });
    const data = prisma.ledger.update.mock.calls[0][0].data;
    expect(data).toEqual({ name: 'اسم جديد', budgetsEnabled: true });
  });

  it('cannot change the ledger type even if the body carries one', async () => {
    const { svc, prisma } = service();
    const forged = { name: 'x', type: 'BUSINESS', baseCurrencyId: 'other' } as unknown as UpdateLedgerSettingsDto;
    await svc.updateSettings(LEDGER_OWNED, OWNER, forged);
    const data = prisma.ledger.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('type');
    expect(data).not.toHaveProperty('baseCurrencyId');
    expect(data).toEqual({ name: 'x' });
  });

  it('rejects a non-owner settings change', async () => {
    const { svc } = service();
    await expect(svc.updateSettings(LEDGER_OWNED, MEMBER, { name: 'x' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns 404 for an unknown ledger on settings change', async () => {
    const { svc } = service();
    await expect(svc.updateSettings(UNKNOWN_LEDGER, OWNER, { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
