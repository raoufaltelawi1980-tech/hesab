import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StockService, type PostingStockParams } from './stock.service.js';

const LEDGER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_LEDGER_ID = '22222222-2222-4222-8222-222222222222';
const HOME_LEDGER_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_ID = '44444444-4444-4444-8444-444444444444';
const PRODUCT_ID = '55555555-5555-4555-8555-555555555555';
const WAREHOUSE_ID = '66666666-6666-4666-8666-666666666666';
const ENTRY_ID = '77777777-7777-4777-8777-777777777777';

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
    entryId: ENTRY_ID,
    businessDate: new Date('2026-10-01T00:00:00Z'),
    note: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    ...overrides,
  };
}

type Options = {
  movements?: MovementRow[];
  hasDefaultWarehouse?: boolean;
  archivedProduct?: boolean;
  productKind?: string;
  trackStock?: boolean;
};

function makePrisma(options: Options = {}) {
  const state = { movements: [...(options.movements ?? [])] };
  const hasDefault = options.hasDefaultWarehouse ?? true;

  const prisma: any = {
    ledger: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id === LEDGER_ID) return { id: LEDGER_ID, ownerId: OWNER_ID, type: 'BUSINESS', baseCurrencyId: WAREHOUSE_ID, stockEnabled: true };
        if (where.id === HOME_LEDGER_ID) return { id: HOME_LEDGER_ID, ownerId: OWNER_ID, type: 'HOUSEHOLD', baseCurrencyId: WAREHOUSE_ID, stockEnabled: false };
        return null;
      }),
    },
    ledgerMember: { findUnique: vi.fn(async () => null) },
    product: {
      findUnique: vi.fn(async ({ where }: any) =>
        where.id === PRODUCT_ID
          ? {
              id: PRODUCT_ID,
              ledgerId: LEDGER_ID,
              kind: options.productKind ?? 'GOOD',
              trackStock: options.trackStock ?? true,
              defaultWarehouseId: null,
              archivedAt: options.archivedProduct ? new Date() : null,
            }
          : null,
      ),
    },
    warehouse: {
      findUnique: vi.fn(async ({ where }: any) => (where.id === WAREHOUSE_ID ? { id: WAREHOUSE_ID } : null)),
      findFirst: vi.fn(async () => (hasDefault ? { id: WAREHOUSE_ID } : null)),
    },
    stockMovement: {
      findMany: vi.fn(async ({ where }: any) =>
        state.movements.filter((m) => m.ledgerId === where.ledgerId && m.productId === where.productId),
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
  return { prisma, state };
}

function service(options: Options = {}) {
  const { prisma, state } = makePrisma(options);
  return { svc: new StockService(prisma as never), prisma, state };
}

function params(overrides: Partial<PostingStockParams> = {}): PostingStockParams {
  return {
    ledgerId: LEDGER_ID,
    entryId: ENTRY_ID,
    kind: 'PURCHASE_CASH',
    product: {
      id: PRODUCT_ID,
      kind: 'GOOD',
      trackStock: true,
      defaultWarehouseId: null,
      archivedAt: null,
    } as PostingStockParams['product'],
    quantity: new Prisma.Decimal('10'),
    baseAmount: new Prisma.Decimal('1000'),
    businessDate: new Date('2026-10-01T00:00:00Z'),
    ...overrides,
  };
}

describe('StockService.getStock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses a HOUSEHOLD ledger', async () => {
    const { svc } = service();
    await expect(svc.getStock(HOME_LEDGER_ID, OWNER_ID, PRODUCT_ID)).rejects.toThrow(/LEDGER_NOT_BUSINESS/);
  });

  it('sums quantities and values and derives WAC', async () => {
    const { svc } = service({
      movements: [
        movement({ quantity: new Prisma.Decimal('10'), unitCost: new Prisma.Decimal('100') }),
        movement({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', quantity: new Prisma.Decimal('10'), unitCost: new Prisma.Decimal('300') }),
      ],
    });
    const stock = await svc.getStock(LEDGER_ID, OWNER_ID, PRODUCT_ID);
    expect(stock.quantity).toBe('20.000000');
    expect(stock.value).toBe('4000.0000');
    expect(stock.wac).toBe('200.0000');
  });

  it('reports zero for a product with no movements', async () => {
    const { svc } = service();
    const stock = await svc.getStock(LEDGER_ID, OWNER_ID, PRODUCT_ID);
    expect(stock.quantity).toBe('0.000000');
    expect(stock.wac).toBe('0.0000');
  });
});

describe('StockService.listMovements', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps only movements of the same product and ledger', async () => {
    const { svc } = service({
      movements: [
        movement(),
        movement({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', productId: OTHER_LEDGER_ID }),
        movement({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', ledgerId: OTHER_LEDGER_ID }),
      ],
    });
    const items = await svc.listMovements(LEDGER_ID, OWNER_ID, PRODUCT_ID);
    expect(items).toHaveLength(1);
  });
});

describe('StockService.applyTransactionStock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records a positive movement for a purchase at the unit cost', async () => {
    const { svc, prisma } = service();
    const result = await svc.applyTransactionStock(prisma as never, params({ quantity: new Prisma.Decimal('10'), baseAmount: new Prisma.Decimal('1000') }));
    expect(result).not.toBeNull();
    expect(result!.type).toBe('PURCHASE');
    expect(result!.unitCost.toFixed(4)).toBe('100.0000');
    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'PURCHASE', quantity: expect.anything() }) }),
    );
  });

  it('values a sale with WAC over two purchases and records COGS', async () => {
    const { svc, prisma } = service({
      movements: [
        movement({ quantity: new Prisma.Decimal('10'), unitCost: new Prisma.Decimal('100') }),
        movement({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', quantity: new Prisma.Decimal('10'), unitCost: new Prisma.Decimal('300') }),
      ],
    });
    const result = await svc.applyTransactionStock(
      prisma as never,
      params({ kind: 'SALE_CASH', quantity: new Prisma.Decimal('5'), baseAmount: new Prisma.Decimal('1500') }),
    );
    expect(result!.type).toBe('SALE');
    expect(result!.unitCost.toFixed(4)).toBe('200.0000');
    expect(result!.cogs.toFixed(4)).toBe('1000.0000');
    expect(result!.balance.toFixed(6)).toBe('15.000000');
  });

  it('refuses a sale that exceeds the balance', async () => {
    const { svc, prisma } = service({
      movements: [movement({ quantity: new Prisma.Decimal('3') })],
    });
    await expect(
      svc.applyTransactionStock(prisma as never, params({ kind: 'SALE_CASH', quantity: new Prisma.Decimal('5') })),
    ).rejects.toThrow(/INSUFFICIENT_STOCK/);
  });

  it('refuses a zero quantity', async () => {
    const { svc, prisma } = service();
    await expect(
      svc.applyTransactionStock(prisma as never, params({ quantity: new Prisma.Decimal('0') })),
    ).rejects.toThrow(/INVALID_QUANTITY/);
  });

  it('refuses an archived product', async () => {
    const { svc, prisma } = service({ archivedProduct: true });
    await expect(
      svc.applyTransactionStock(
        prisma as never,
        params({ product: { id: PRODUCT_ID, kind: 'GOOD', trackStock: true, defaultWarehouseId: null, archivedAt: new Date() } as PostingStockParams['product'] }),
      ),
    ).rejects.toThrow(/PRODUCT_ARCHIVED/);
  });

  it('records nothing for a service product', async () => {
    const { svc, prisma } = service();
    const result = await svc.applyTransactionStock(
      prisma as never,
      params({ product: { id: PRODUCT_ID, kind: 'SERVICE', trackStock: false, defaultWarehouseId: null, archivedAt: null } as PostingStockParams['product'] }),
    );
    expect(result).toBeNull();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('requires a default warehouse when the product has none', async () => {
    const { svc, prisma } = service({ hasDefaultWarehouse: false });
    await expect(svc.applyTransactionStock(prisma as never, params())).rejects.toThrow(/WAREHOUSE_REQUIRED/);
  });

  it('never exposes a delete on stock movements', async () => {
    const { prisma } = service();
    expect('delete' in prisma.stockMovement).toBe(false);
    expect('deleteMany' in prisma.stockMovement).toBe(false);
  });
});
