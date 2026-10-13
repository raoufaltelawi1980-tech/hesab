import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WarehousesService } from './warehouses.service.js';
import type { CreateWarehouseDto } from './dto/create-warehouse.dto.js';

const LEDGER_ID = '11111111-1111-4111-8111-111111111111';
const HOME_LEDGER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_LEDGER_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_ID = '44444444-4444-4444-8444-444444444444';
const MEMBER_ID = '55555555-5555-4555-8555-555555555555';
const CURRENCY_ID = '66666666-6666-4666-8666-666666666666';
const WAREHOUSE_ID = '77777777-7777-4777-8777-777777777777';
const SECOND_ID = '88888888-8888-4888-8888-888888888888';
const FOREIGN_ID = '99999999-9999-4999-8999-999999999999';

type WarehouseRow = {
  id: string;
  ledgerId: string;
  name: string;
  isDefault: boolean;
  currencyId: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeWarehouse(overrides: Partial<WarehouseRow> = {}): WarehouseRow {
  return {
    id: WAREHOUSE_ID,
    ledgerId: LEDGER_ID,
    name: 'الرئيسي',
    isDefault: true,
    currencyId: CURRENCY_ID,
    archivedAt: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    ...overrides,
  };
}

type Options = {
  permissions?: { permission: string; revokedAt: Date | null }[];
  warehouses?: WarehouseRow[];
};

function makePrisma(options: Options = {}) {
  const state = { warehouses: [...(options.warehouses ?? [])] };

  const prisma: any = {
    ledger: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id === LEDGER_ID) return { id: LEDGER_ID, ownerId: OWNER_ID, type: 'BUSINESS', baseCurrencyId: CURRENCY_ID, stockEnabled: true };
        if (where.id === HOME_LEDGER_ID) return { id: HOME_LEDGER_ID, ownerId: OWNER_ID, type: 'HOUSEHOLD', baseCurrencyId: CURRENCY_ID, stockEnabled: false };
        return null;
      }),
    },
    ledgerMember: {
      findUnique: vi.fn(async () => (options.permissions ? { permissions: options.permissions } : null)),
    },
    currency: {
      findUnique: vi.fn(async ({ where }: any) => (where.id === CURRENCY_ID ? { id: CURRENCY_ID } : null)),
    },
    warehouse: {
      findUnique: vi.fn(async ({ where }: any) => state.warehouses.find((w) => w.id === where.id) ?? null),
      findMany: vi.fn(async ({ where }: any) => state.warehouses.filter((w) => w.ledgerId === where.ledgerId && w.archivedAt === null)),
      count: vi.fn(async ({ where }: any) => state.warehouses.filter((w) => w.ledgerId === where.ledgerId && w.archivedAt === null).length),
      create: vi.fn(async ({ data }: any) => {
        const row = makeWarehouse({ ...data, id: SECOND_ID, archivedAt: null, createdAt: new Date(), updatedAt: new Date() });
        state.warehouses.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.warehouses.find((w) => w.id === where.id)!;
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        for (const w of state.warehouses) {
          if (w.ledgerId !== where.ledgerId) continue;
          if (where.isDefault !== undefined && w.isDefault !== where.isDefault) continue;
          if (where.id?.not && w.id === where.id.not) continue;
          Object.assign(w, data);
        }
        return { count: 1 };
      }),
    },
  };

  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));
  return { prisma, state };
}

function service(options: Options = {}) {
  const { prisma, state } = makePrisma(options);
  return { svc: new WarehousesService(prisma as never), prisma, state };
}

function dto(overrides: Partial<CreateWarehouseDto> = {}): CreateWarehouseDto {
  return { name: 'المستودع الرئيسي', ...overrides } as CreateWarehouseDto;
}

describe('WarehousesService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses a HOUSEHOLD ledger', async () => {
    const { svc } = service();
    await expect(svc.create(HOME_LEDGER_ID, OWNER_ID, dto())).rejects.toThrow(/LEDGER_NOT_BUSINESS/);
  });

  it('requires LEDGER_MANAGE to create', async () => {
    const { svc } = service({ permissions: [{ permission: 'LEDGER_VIEW', revokedAt: null }] });
    await expect(svc.create(LEDGER_ID, MEMBER_ID, dto())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('makes the first warehouse the default', async () => {
    const { svc } = service();
    const created = await svc.create(LEDGER_ID, OWNER_ID, dto());
    expect(created.isDefault).toBe(true);
  });

  it('keeps a later non-default warehouse as secondary', async () => {
    const { svc } = service({ warehouses: [makeWarehouse()] });
    const created = await svc.create(LEDGER_ID, OWNER_ID, dto({ name: 'فرعي' }));
    expect(created.isDefault).toBe(false);
  });

  it('unsets the previous default when a new default is requested', async () => {
    const { svc, state } = service({ warehouses: [makeWarehouse()] });
    await svc.create(LEDGER_ID, OWNER_ID, dto({ name: 'فرعي', isDefault: true }));
    const defaults = state.warehouses.filter((w) => w.isDefault);
    expect(defaults).toHaveLength(1);
  });

  it('refuses to archive the default warehouse', async () => {
    const { svc } = service({ warehouses: [makeWarehouse()] });
    await expect(svc.archive(LEDGER_ID, WAREHOUSE_ID, OWNER_ID)).rejects.toThrow(/WAREHOUSE_DEFAULT/);
  });

  it('archives a non-default warehouse instead of deleting', async () => {
    const { svc, prisma, state } = service({ warehouses: [makeWarehouse(), makeWarehouse({ id: SECOND_ID, name: 'فرعي', isDefault: false })] });
    const result = await svc.archive(LEDGER_ID, SECOND_ID, OWNER_ID);
    expect(result.warehouse.archivedAt).not.toBeNull();
    expect(state.warehouses).toHaveLength(2);
    expect('delete' in prisma.warehouse).toBe(false);
  });

  it('refuses to read a warehouse from another ledger', async () => {
    const { svc } = service({ warehouses: [makeWarehouse({ id: FOREIGN_ID, ledgerId: OTHER_LEDGER_ID })] });
    await expect(svc.get(LEDGER_ID, FOREIGN_ID, OWNER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses an empty name', async () => {
    const { svc } = service();
    await expect(svc.create(LEDGER_ID, OWNER_ID, dto({ name: '   ' }))).rejects.toBeInstanceOf(BadRequestException);
  });
});
