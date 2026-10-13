import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductsService } from './products.service.js';
import type { CreateProductDto } from './dto/create-product.dto.js';

const LEDGER_ID = '11111111-1111-4111-8111-111111111111';
const NO_STOCK_LEDGER_ID = '22222222-2222-4222-8222-222222222222';
const HOME_LEDGER_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_LEDGER_ID = '44444444-4444-4444-8444-444444444444';
const OWNER_ID = '55555555-5555-4555-8555-555555555555';
const MEMBER_ID = '66666666-6666-4666-8666-666666666666';
const CURRENCY_ID = '77777777-7777-4777-8777-777777777777';
const WAREHOUSE_ID = '88888888-8888-4888-8888-888888888888';
const FOREIGN_WAREHOUSE_ID = '99999999-9999-4999-8999-999999999999';
const PRODUCT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ARCHIVED_PRODUCT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

type ProductRow = {
  id: string;
  ledgerId: string;
  kind: string;
  sku: string | null;
  name: string;
  description: string | null;
  unitPrice: Prisma.Decimal;
  costPrice: Prisma.Decimal | null;
  currencyId: string;
  trackStock: boolean;
  defaultWarehouseId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeProduct(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: PRODUCT_ID,
    ledgerId: LEDGER_ID,
    kind: 'GOOD',
    sku: 'SKU-1',
    name: 'جهاز',
    description: null,
    unitPrice: new Prisma.Decimal('120'),
    costPrice: null,
    currencyId: CURRENCY_ID,
    trackStock: true,
    defaultWarehouseId: null,
    archivedAt: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    ...overrides,
  };
}

type Options = {
  permissions?: { permission: string; revokedAt: Date | null }[];
  products?: ProductRow[];
  warehouses?: { id: string; ledgerId: string; archivedAt: Date | null }[];
};

function makePrisma(options: Options = {}) {
  const state = { products: [...(options.products ?? [])] };
  const warehouses = options.warehouses ?? [
    { id: WAREHOUSE_ID, ledgerId: LEDGER_ID, archivedAt: null },
    { id: FOREIGN_WAREHOUSE_ID, ledgerId: OTHER_LEDGER_ID, archivedAt: null },
  ];

  const prisma: any = {
    ledger: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id === LEDGER_ID) return { id: LEDGER_ID, ownerId: OWNER_ID, type: 'BUSINESS', baseCurrencyId: CURRENCY_ID, stockEnabled: true };
        if (where.id === NO_STOCK_LEDGER_ID) return { id: NO_STOCK_LEDGER_ID, ownerId: OWNER_ID, type: 'BUSINESS', baseCurrencyId: CURRENCY_ID, stockEnabled: false };
        if (where.id === HOME_LEDGER_ID) return { id: HOME_LEDGER_ID, ownerId: OWNER_ID, type: 'HOUSEHOLD', baseCurrencyId: CURRENCY_ID, stockEnabled: false };
        return null;
      }),
    },
    ledgerMember: {
      findUnique: vi.fn(async () =>
        options.permissions ? { permissions: options.permissions } : null,
      ),
    },
    currency: {
      findUnique: vi.fn(async ({ where }: any) => (where.id === CURRENCY_ID ? { id: CURRENCY_ID } : null)),
    },
    warehouse: {
      findUnique: vi.fn(async ({ where }: any) => warehouses.find((w) => w.id === where.id) ?? null),
    },
    product: {
      findUnique: vi.fn(async ({ where }: any) => state.products.find((p) => p.id === where.id) ?? null),
      findFirst: vi.fn(
        async ({ where }: any) =>
          state.products.find(
            (p) => p.ledgerId === where.ledgerId && (where.sku === undefined || p.sku === where.sku),
          ) ?? null,
      ),
      findMany: vi.fn(async ({ where }: any) =>
        state.products.filter(
          (p) =>
            p.ledgerId === where.ledgerId &&
            (where.kind ? p.kind === where.kind : true) &&
            (where.archivedAt === null ? p.archivedAt === null : true),
        ),
      ),
      create: vi.fn(async ({ data }: any) => {
        const row = makeProduct({ ...data, id: PRODUCT_ID, createdAt: new Date(), updatedAt: new Date() });
        state.products.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.products.find((p) => p.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
  };
  return { prisma, state };
}

function service(options: Options = {}) {
  const { prisma, state } = makePrisma(options);
  return { svc: new ProductsService(prisma as never), prisma, state };
}

function dto(overrides: Partial<CreateProductDto> = {}): CreateProductDto {
  return { kind: 'GOOD', name: 'جهاز', unitPrice: '120', ...overrides } as CreateProductDto;
}

describe('ProductsService gating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses a HOUSEHOLD ledger', async () => {
    const { svc } = service();
    await expect(svc.create(HOME_LEDGER_ID, OWNER_ID, dto())).rejects.toThrow(/LEDGER_NOT_BUSINESS/);
  });

  it('refuses a ledger with stock disabled', async () => {
    const { svc } = service();
    await expect(svc.create(NO_STOCK_LEDGER_ID, OWNER_ID, dto())).rejects.toThrow(/FEATURE_DISABLED/);
  });

  it('requires LEDGER_MANAGE to create', async () => {
    const { svc } = service({ permissions: [{ permission: 'LEDGER_VIEW', revokedAt: null }] });
    await expect(svc.create(LEDGER_ID, MEMBER_ID, dto())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows LEDGER_VIEW on a member to list', async () => {
    const { svc } = service({
      permissions: [{ permission: 'LEDGER_VIEW', revokedAt: null }],
      products: [makeProduct()],
    });
    const items = await svc.list(LEDGER_ID, MEMBER_ID);
    expect(items).toHaveLength(1);
  });

  it('answers 404 for an unknown product', async () => {
    const { svc } = service();
    await expect(svc.get(LEDGER_ID, PRODUCT_ID, OWNER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ProductsService validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a stocked GOOD with the ledger base currency', async () => {
    const { svc, prisma } = service();
    const created = await svc.create(LEDGER_ID, OWNER_ID, dto({ costPrice: '90' }));
    expect(created).toMatchObject({ kind: 'GOOD', trackStock: false, currencyId: CURRENCY_ID });
    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currencyId: CURRENCY_ID, costPrice: expect.anything() }) }),
    );
  });

  it('refuses a SERVICE with trackStock', async () => {
    const { svc } = service();
    await expect(
      svc.create(LEDGER_ID, OWNER_ID, dto({ kind: 'SERVICE', trackStock: true })),
    ).rejects.toThrow(/PRODUCT_NOT_STOCKED/);
  });

  it('refuses a default warehouse on a non-stocked product', async () => {
    const { svc } = service();
    await expect(
      svc.create(LEDGER_ID, OWNER_ID, dto({ trackStock: false, defaultWarehouseId: WAREHOUSE_ID })),
    ).rejects.toThrow(/PRODUCT_NOT_STOCKED/);
  });

  it('refuses a warehouse from another ledger', async () => {
    const { svc } = service();
    await expect(
      svc.create(LEDGER_ID, OWNER_ID, dto({ trackStock: true, defaultWarehouseId: FOREIGN_WAREHOUSE_ID })),
    ).rejects.toThrow(/WAREHOUSE_NOT_FOUND/);
  });

  it('refuses a duplicate SKU inside the ledger', async () => {
    const { svc } = service({ products: [makeProduct({ sku: 'SKU-1' })] });
    await expect(svc.create(LEDGER_ID, OWNER_ID, dto({ sku: 'SKU-1' }))).rejects.toThrow(/SKU_DUPLICATE/);
  });

  it('refuses an invalid kind', async () => {
    const { svc } = service();
    await expect(svc.create(LEDGER_ID, OWNER_ID, dto({ kind: 'THING' }))).rejects.toThrow(/PRODUCT_KIND_INVALID/);
  });
});

describe('ProductsService archive and isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('archives instead of deleting', async () => {
    const { svc, prisma, state } = service({ products: [makeProduct()] });
    const result = await svc.archive(LEDGER_ID, PRODUCT_ID, OWNER_ID);
    expect(result.product.archivedAt).not.toBeNull();
    expect(state.products).toHaveLength(1);
    expect('delete' in prisma.product).toBe(false);
  });

  it('hides archived products by default and reveals them on request', async () => {
    const { svc } = service({
      products: [makeProduct(), makeProduct({ id: ARCHIVED_PRODUCT_ID, sku: null, archivedAt: new Date() })],
    });
    expect(await svc.list(LEDGER_ID, OWNER_ID)).toHaveLength(1);
    expect(await svc.list(LEDGER_ID, OWNER_ID, { includeArchived: 'true' })).toHaveLength(2);
  });

  it('refuses to edit an archived product', async () => {
    const { svc } = service({ products: [makeProduct({ archivedAt: new Date() })] });
    await expect(svc.update(LEDGER_ID, PRODUCT_ID, OWNER_ID, { name: 'جديد' })).rejects.toThrow(/PRODUCT_ARCHIVED/);
  });

  it('refuses to read a product from another ledger', async () => {
    const { svc } = service({ products: [makeProduct({ ledgerId: OTHER_LEDGER_ID })] });
    await expect(svc.get(LEDGER_ID, PRODUCT_ID, OWNER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filters the list by kind', async () => {
    const { svc } = service({
      products: [makeProduct(), makeProduct({ id: ARCHIVED_PRODUCT_ID, kind: 'SERVICE', sku: null, trackStock: false })],
    });
    const services = await svc.list(LEDGER_ID, OWNER_ID, { kind: 'SERVICE' });
    expect(services).toHaveLength(1);
    expect(services[0].kind).toBe('SERVICE');
  });
});
