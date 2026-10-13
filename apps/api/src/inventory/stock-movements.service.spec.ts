import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StockService } from './stock.service.js';
import type { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';

const LEDGER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_LEDGER_ID = '22222222-2222-4222-8222-222222222222';
const HOME_LEDGER_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_ID = '44444444-4444-4444-8444-444444444444';
const MEMBER_ID = '55555555-5555-4555-8555-555555555555';
const PRODUCT_ID = '66666666-6666-4666-8666-666666666666';
const WAREHOUSE_ID = '77777777-7777-4777-8777-777777777777';
const FOREIGN_WAREHOUSE_ID = '88888888-8888-4888-8888-888888888888';

type MovementRow = {
  id: string;
  ledgerId: string;
  productId: string;
  warehouseId: string;
  type: string;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal | null;
  entryId: string | null;
  businessDate: Date;
  note: string | null;
  createdAt: Date;
};

function movement(overrides: Partial<MovementRow> = {}): MovementRow {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ledgerId: LEDGER_ID,
    productId: PRODUCT_ID,
    warehouseId: WAREHOUSE_ID,
    type: 'PURCHASE',
    quantity: new Prisma.Decimal('10'),
    unitCost: new Prisma.Decimal('100'),
    entryId: null,
    businessDate: new Date('2026-10-01T00:00:00Z'),
    note: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    ...overrides,
  };
}

type Options = {
  permissions?: { permission: string; revokedAt: Date | null }[];
  movements?: MovementRow[];
  archivedProduct?: boolean;
  archivedWarehouse?: boolean;
  productKind?: string;
  trackStock?: boolean;
  costPrice?: Prisma.Decimal | null;
};

function makePrisma(options: Options = {}) {
  const state = { movements: [...(options.movements ?? [])] };

  const prisma: any = {
    ledger: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id === LEDGER_ID) return { id: LEDGER_ID, ownerId: OWNER_ID, type: 'BUSINESS', baseCurrencyId: WAREHOUSE_ID, stockEnabled: true };
        if (where.id === HOME_LEDGER_ID) return { id: HOME_LEDGER_ID, ownerId: OWNER_ID, type: 'HOUSEHOLD', baseCurrencyId: WAREHOUSE_ID, stockEnabled: false };
        return null;
      }),
    },
    ledgerMember: {
      findUnique: vi.fn(async () => (options.permissions ? { permissions: options.permissions } : null)),
    },
    product: {
      findUnique: vi.fn(async ({ where }: any) =>
        where.id === PRODUCT_ID
          ? {
              id: PRODUCT_ID,
              ledgerId: LEDGER_ID,
              kind: options.productKind ?? 'GOOD',
              trackStock: options.trackStock ?? true,
              costPrice: options.costPrice ?? null,
              unitPrice: new Prisma.Decimal('150'),
              archivedAt: options.archivedProduct ? new Date() : null,
            }
          : null,
      ),
    },
    warehouse: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id === WAREHOUSE_ID) {
          return { id: WAREHOUSE_ID, ledgerId: LEDGER_ID, archivedAt: options.archivedWarehouse ? new Date() : null };
        }
        if (where.id === FOREIGN_WAREHOUSE_ID) {
          return { id: FOREIGN_WAREHOUSE_ID, ledgerId: OTHER_LEDGER_ID, archivedAt: null };
        }
        return null;
      }),
    },
    stockMovement: {
      findMany: vi.fn(async ({ where }: any) =>
        state.movements.filter(
          (m) =>
            m.ledgerId === where.ledgerId &&
            m.productId === where.productId &&
            (!where.warehouseId || m.warehouseId === where.warehouseId),
        ),
      ),
      create: vi.fn(async ({ data }: any) => {
        const row: MovementRow = {
          id: `00000000-0000-4000-8000-00000000000${state.movements.length + 1}`,
          ledgerId: data.ledgerId,
          productId: data.productId,
          warehouseId: data.warehouseId,
          type: data.type,
          quantity: data.quantity,
          unitCost: data.unitCost ?? null,
          entryId: data.entryId ?? null,
          businessDate: data.businessDate,
          note: data.note ?? null,
          createdAt: new Date(),
        };
        state.movements.push(row);
        return row;
      }),
    },
  };
  prisma.$transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback(prisma));
  return { prisma, state };
}

function service(options: Options = {}) {
  const { prisma, state } = makePrisma(options);
  return { svc: new StockService(prisma as never), prisma, state };
}

function dto(overrides: Partial<CreateStockMovementDto> = {}): CreateStockMovementDto {
  return {
    productId: PRODUCT_ID,
    warehouseId: WAREHOUSE_ID,
    type: 'ADJUSTMENT_IN',
    quantity: '5',
    ...overrides,
  } as CreateStockMovementDto;
}

describe('StockService.createManualMovement gating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses a HOUSEHOLD ledger', async () => {
    const { svc } = service();
    await expect(svc.createManualMovement(HOME_LEDGER_ID, OWNER_ID, dto())).rejects.toThrow(/LEDGER_NOT_BUSINESS/);
  });

  it('requires ENTRY_CREATE', async () => {
    const { svc } = service({ permissions: [{ permission: 'ENTRY_VIEW', revokedAt: null }] });
    await expect(svc.createManualMovement(LEDGER_ID, MEMBER_ID, dto())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses PURCHASE and SALE through the manual route', async () => {
    const { svc } = service({ permissions: [{ permission: 'ENTRY_CREATE', revokedAt: null }] });
    await expect(svc.createManualMovement(LEDGER_ID, MEMBER_ID, dto({ type: 'SALE' }))).rejects.toThrow(/MOVEMENT_TYPE_INVALID/);
  });

  it('refuses a zero quantity', async () => {
    const { svc } = service();
    await expect(svc.createManualMovement(LEDGER_ID, OWNER_ID, dto({ quantity: '0' }))).rejects.toThrow(/INVALID_QUANTITY/);
  });

  it('refuses a SERVICE or non-tracked product', async () => {
    const { svc } = service({ productKind: 'SERVICE', trackStock: false });
    await expect(svc.createManualMovement(LEDGER_ID, OWNER_ID, dto())).rejects.toThrow(/PRODUCT_NOT_STOCKED/);
  });

  it('refuses an archived product', async () => {
    const { svc } = service({ archivedProduct: true });
    await expect(svc.createManualMovement(LEDGER_ID, OWNER_ID, dto())).rejects.toThrow(/PRODUCT_ARCHIVED/);
  });

  it('refuses a warehouse from another ledger', async () => {
    const { svc } = service();
    await expect(
      svc.createManualMovement(LEDGER_ID, OWNER_ID, dto({ warehouseId: FOREIGN_WAREHOUSE_ID })),
    ).rejects.toThrow(/WAREHOUSE_NOT_FOUND/);
  });
});

describe('StockService.createManualMovement behaviour', () => {
  beforeEach(() => vi.clearAllMocks());

  it('values ADJUSTMENT_IN at the current WAC and keeps it unchanged', async () => {
    const { svc, state } = service({ movements: [movement()] });
    const result = await svc.createManualMovement(LEDGER_ID, OWNER_ID, dto({ type: 'ADJUSTMENT_IN', quantity: '10' }));
    expect(result.movement.type).toBe('ADJUSTMENT_IN');
    expect(result.movement.quantity).toBe('10.000000');
    expect(result.movement.unitCost).toBe('100.0000');
    expect(state.movements).toHaveLength(2);
  });

  it('falls back to costPrice for the first inbound movement', async () => {
    const { svc } = service({ costPrice: new Prisma.Decimal('80') });
    const result = await svc.createManualMovement(LEDGER_ID, OWNER_ID, dto({ type: 'RETURN_IN', quantity: '4' }));
    expect(result.movement.unitCost).toBe('80.0000');
    expect(result.movement.quantity).toBe('4.000000');
  });

  it('records ADJUSTMENT_OUT as a negative movement at WAC', async () => {
    const { svc } = service({ movements: [movement()] });
    const result = await svc.createManualMovement(LEDGER_ID, OWNER_ID, dto({ type: 'ADJUSTMENT_OUT', quantity: '3' }));
    expect(result.movement.quantity).toBe('-3.000000');
    expect(result.movement.unitCost).toBe('100.0000');
  });

  it('refuses an outbound movement that exceeds the warehouse balance', async () => {
    const { svc } = service({ movements: [movement({ quantity: new Prisma.Decimal('2') })] });
    await expect(
      svc.createManualMovement(LEDGER_ID, OWNER_ID, dto({ type: 'RETURN_OUT', quantity: '5' })),
    ).rejects.toThrow(/INSUFFICIENT_STOCK/);
  });

  it('stores the reason in the movement note and never attaches an entry', async () => {
    const { svc } = service({ movements: [movement()] });
    const result = await svc.createManualMovement(
      LEDGER_ID,
      OWNER_ID,
      dto({ type: 'ADJUSTMENT_OUT', quantity: '1', reason: 'جرد' }),
    );
    expect(result.movement.note).toBe('جرد');
    expect(result.movement.entryId).toBeNull();
  });
});
