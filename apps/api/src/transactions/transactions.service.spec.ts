import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StockService } from '../inventory/stock.service.js';
import { TransactionsService } from './transactions.service.js';
import type { CreateDraftDto } from './dto/create-draft.dto.js';

const LEDGER_ID = '11111111-1111-4111-8111-111111111111';
const HOME_LEDGER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_LEDGER_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_ID = '44444444-4444-4444-8444-444444444444';
const MEMBER_ID = '55555555-5555-4555-8555-555555555555';
const ACCOUNT_ID = '66666666-6666-4666-8666-666666666666';
const HOME_ACCOUNT_ID = '77777777-7777-4777-8777-777777777777';
const CPTY_ACCOUNT_ID = '70707070-7070-4070-8070-707070707070';
const CATEGORY_ID = '88888888-8888-4888-8888-888888888888';
const HOME_CATEGORY_ID = '89898989-8989-4898-8989-898989898989';
const CURRENCY_ID = '99999999-9999-4999-8999-999999999999';
const CUSTOMER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SUPPLIER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ARCHIVED_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const FOREIGN_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const HOME_CONTACT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const DRAFT_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const LINE_ID = '12121212-1212-4121-8121-121212121212';
const ENTRY_ID = '13131313-1313-4131-8131-131313131313';
const DEBT_ID = '14141414-1414-4141-8141-141414141414';
const PRODUCT_ID = '15151515-1515-4151-8151-151515151515';
const SERVICE_PRODUCT_ID = '16161616-1616-4161-8161-161616161616';
const FOREIGN_PRODUCT_ID = '18181818-1818-4181-8181-181818181818';
const WAREHOUSE_ID = '19191919-1919-4191-8191-191919191919';
const STOCK_MOVEMENT_ID = '20202020-2020-4020-8020-202020202020';

type ContactRow = {
  id: string;
  ledgerId: string;
  kind: string;
  name: string;
  archivedAt: Date | null;
};

function makeContact(overrides: Partial<ContactRow> = {}): ContactRow {
  return {
    id: CUSTOMER_ID,
    ledgerId: LEDGER_ID,
    kind: 'CUSTOMER',
    name: 'شركة الوفاء',
    archivedAt: null,
    ...overrides,
  };
}

function defaultContacts(): ContactRow[] {
  return [
    makeContact(),
    makeContact({ id: SUPPLIER_ID, kind: 'SUPPLER', name: 'مورد الخير' }),
    makeContact({ id: ARCHIVED_ID, archivedAt: new Date('2026-01-01T00:00:00Z') }),
    makeContact({ id: FOREIGN_ID, ledgerId: OTHER_LEDGER_ID, name: 'عميل دفتر آخر' }),
    makeContact({ id: HOME_CONTACT_ID, ledgerId: HOME_LEDGER_ID, name: 'عميل عائلي' }),
  ];
}

type DraftRow = {
  id: string;
  ledgerId: string;
  status: string;
  kind: string;
  description: string | null;
  occurredAt: Date;
  businessDate: Date;
  originalCurrencyId: string;
  originalAmount: Prisma.Decimal;
  baseAmount: Prisma.Decimal;
  baseCurrencyId: string;
  contactId: string | null;
  productId: string | null;
  quantity: Prisma.Decimal | null;
  createdById: string;
  postedEntryId: string | null;
  counterpartyAccountId: string | null;
  transferTreatment: string | null;
  lines: Record<string, unknown>[];
};

type ProductRow = {
  id: string;
  ledgerId: string;
  kind: string;
  name: string;
  trackStock: boolean;
  defaultWarehouseId: string | null;
  archivedAt: Date | null;
};

type WarehouseRow = {
  id: string;
  ledgerId: string;
  name: string;
  isDefault: boolean;
  currencyId: string;
  archivedAt: Date | null;
};

type StockMovementRow = {
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
};

function makeProduct(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: PRODUCT_ID,
    ledgerId: LEDGER_ID,
    kind: 'GOOD',
    name: 'جهاز',
    trackStock: true,
    defaultWarehouseId: null,
    archivedAt: null,
    ...overrides,
  };
}

function makeWarehouse(overrides: Partial<WarehouseRow> = {}): WarehouseRow {
  return {
    id: WAREHOUSE_ID,
    ledgerId: LEDGER_ID,
    name: 'المستودع الرئيسي',
    isDefault: true,
    currencyId: CURRENCY_ID,
    archivedAt: null,
    ...overrides,
  };
}

function makeDraft(overrides: Partial<DraftRow> = {}): DraftRow {
  return {
    id: DRAFT_ID,
    ledgerId: LEDGER_ID,
    status: 'CONFIRMED',
    kind: 'SALE_CREDIT',
    description: 'فاتورة 2026/104',
    occurredAt: new Date('2026-10-03T10:20:00Z'),
    businessDate: new Date('2026-10-03T00:00:00Z'),
    originalCurrencyId: CURRENCY_ID,
    originalAmount: new Prisma.Decimal('1200'),
    baseAmount: new Prisma.Decimal('1200'),
    baseCurrencyId: CURRENCY_ID,
    contactId: CUSTOMER_ID,
    productId: null,
    quantity: null,
    createdById: OWNER_ID,
    postedEntryId: null,
    counterpartyAccountId: null,
    transferTreatment: null,
    lines: [
      {
        id: LINE_ID,
        direction: 'DEBIT',
        accountId: ACCOUNT_ID,
        categoryId: CATEGORY_ID,
        categoryItemId: null,
        amount: new Prisma.Decimal('1200'),
        baseAmount: new Prisma.Decimal('1200'),
        memo: null,
      },
    ],
    ...overrides,
  };
}

type Options = {
  ledgerType?: string;
  stockEnabled?: boolean;
  memberPermissions?: { permission: string; revokedAt: Date | null }[];
  contacts?: ContactRow[];
  drafts?: DraftRow[];
  products?: ProductRow[];
  warehouses?: WarehouseRow[];
  stockMovements?: StockMovementRow[];
};

function makePrisma(options: Options = {}) {
  const ledgerType = options.ledgerType ?? 'BUSINESS';
  const stockEnabled = options.stockEnabled ?? true;
  const state = {
    contacts: [...(options.contacts ?? defaultContacts())],
    drafts: [...(options.drafts ?? [])],
    products: [...(options.products ?? [])],
    warehouses: [...(options.warehouses ?? [])],
    stockMovements: [...(options.stockMovements ?? [])],
    entries: [] as Record<string, unknown>[],
    debts: [] as Record<string, unknown>[],
    audit: [] as Record<string, unknown>[],
  };

  const prisma: any = {
    ledger: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id === LEDGER_ID) {
          return {
            id: LEDGER_ID,
            ownerId: OWNER_ID,
            type: ledgerType,
            baseCurrencyId: CURRENCY_ID,
            stockEnabled,
          };
        }
        if (where.id === HOME_LEDGER_ID) {
          return {
            id: HOME_LEDGER_ID,
            ownerId: OWNER_ID,
            type: 'HOUSEHOLD',
            baseCurrencyId: CURRENCY_ID,
            stockEnabled: false,
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
    financialAccount: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id === ACCOUNT_ID) return { id: ACCOUNT_ID, ledgerId: LEDGER_ID, name: 'الصندوق', archivedAt: null };
        if (where.id === CPTY_ACCOUNT_ID) return { id: CPTY_ACCOUNT_ID, ledgerId: LEDGER_ID, name: 'البنك', archivedAt: null };
        if (where.id === HOME_ACCOUNT_ID) return { id: HOME_ACCOUNT_ID, ledgerId: HOME_LEDGER_ID, name: 'بنك', archivedAt: null };
        return null;
      }),
    },
    category: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id === CATEGORY_ID) return { id: CATEGORY_ID, ledgerId: LEDGER_ID, name: 'المبيعات', archivedAt: null };
        if (where.id === HOME_CATEGORY_ID) return { id: HOME_CATEGORY_ID, ledgerId: HOME_LEDGER_ID, name: 'الراتب', archivedAt: null };
        return null;
      }),
    },
    categoryItem: { findUnique: vi.fn(async () => null) },
    currency: {
      findFirst: vi.fn(async ({ where }: any) => (where.code === 'IQD' ? { id: CURRENCY_ID, code: 'IQD' } : null)),
      findUnique: vi.fn(async ({ where }: any) => (where.id === CURRENCY_ID ? { id: CURRENCY_ID, code: 'IQD' } : null)),
    },
    contact: {
      findUnique: vi.fn(async ({ where }: any) => state.contacts.find((c) => c.id === where.id) ?? null),
    },
    draftTransaction: {
      create: vi.fn(async ({ data }: any) => {
        const row: DraftRow = {
          id: DRAFT_ID,
          ledgerId: data.ledgerId,
          status: data.status,
          kind: data.kind,
          description: data.description ?? null,
          occurredAt: data.occurredAt,
          businessDate: data.businessDate,
          originalCurrencyId: data.originalCurrencyId,
          originalAmount: data.originalAmount,
          baseAmount: data.baseAmount,
          baseCurrencyId: data.baseCurrencyId,
          contactId: data.contactId ?? null,
          productId: data.productId ?? null,
          quantity: data.quantity ?? null,
          createdById: data.createdById,
          postedEntryId: null,
          counterpartyAccountId: data.counterpartyAccountId ?? null,
          transferTreatment: data.transferTreatment ?? null,
          lines: [],
        };
        state.drafts.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: any) => state.drafts.find((d) => d.id === where.id) ?? null),
      findMany: vi.fn(async () => state.drafts),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.drafts.find((d) => d.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    draftLine: {
      create: vi.fn(async ({ data }: any) => {
        const draft = state.drafts.find((d) => d.id === data.draftId);
        if (draft) draft.lines.push({ id: LINE_ID, ...data });
        return { id: LINE_ID, ...data };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        for (const draft of state.drafts) {
          const line = draft.lines.find((l) => (l as any).id === where.id);
          if (line) Object.assign(line, data);
        }
        return { id: where.id, ...data };
      }),
    },
    journalEntry: {
      count: vi.fn(async () => state.entries.length),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: ENTRY_ID, ...data };
        state.entries.push(row);
        return row;
      }),
    },
    journalLine: { create: vi.fn(async ({ data }: any) => ({ id: LINE_ID, ...data })) },
    product: {
      findUnique: vi.fn(async ({ where }: any) => state.products.find((p) => p.id === where.id) ?? null),
    },
    warehouse: {
      findUnique: vi.fn(async ({ where }: any) => state.warehouses.find((w) => w.id === where.id) ?? null),
      findFirst: vi.fn(
        async ({ where }: any) =>
          state.warehouses.find(
            (w) => w.ledgerId === where.ledgerId && w.isDefault && !w.archivedAt,
          ) ?? null,
      ),
    },
    stockMovement: {
      findMany: vi.fn(async ({ where }: any) =>
        state.stockMovements.filter(
          (m) => m.ledgerId === where.ledgerId && m.productId === where.productId,
        ),
      ),
      create: vi.fn(async ({ data }: any) => {
        const row: StockMovementRow = {
          id: STOCK_MOVEMENT_ID,
          ledgerId: data.ledgerId,
          productId: data.productId,
          warehouseId: data.warehouseId,
          type: data.type,
          quantity: data.quantity,
          unitCost: data.unitCost ?? null,
          entryId: data.entryId ?? null,
          businessDate: data.businessDate,
          note: data.note ?? null,
        };
        state.stockMovements.push(row);
        return row;
      }),
    },
    debt: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: DEBT_ID, ...data };
        state.debts.push(row);
        return row;
      }),
    },
    transactionAuditLog: {
      create: vi.fn(async ({ data }: any) => {
        state.audit.push(data);
        return { id: LINE_ID, ...data };
      }),
    },
  };

  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));

  return { prisma, state };
}

function service(options: Options = {}) {
  const { prisma, state } = makePrisma(options);
  return { svc: new TransactionsService(prisma as never, new StockService(prisma as never)), prisma, state };
}

function dto(overrides: Partial<CreateDraftDto> = {}): CreateDraftDto {
  return {
    type: 'SALE_CASH',
    financialAccountId: ACCOUNT_ID,
    categoryId: CATEGORY_ID,
    amount: '1200',
    currencyCode: 'IQD',
    ...overrides,
  } as CreateDraftDto;
}

describe('TransactionsService commercial gating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses every commercial kind on a HOUSEHOLD ledger', async () => {
    const { svc } = service();
    for (const type of ['SALE_CASH', 'SALE_CREDIT', 'PURCHASE_CASH', 'PURCHASE_CREDIT'] as const) {
      const failure = svc.createDraft(HOME_LEDGER_ID, OWNER_ID, dto({ type, contactId: undefined }));
      await expect(failure).rejects.toBeInstanceOf(ForbiddenException);
      await expect(failure).rejects.toThrow(/LEDGER_NOT_BUSINESS/);
    }
  });

  it('still allows a plain income entry on a HOUSEHOLD ledger', async () => {
    const { svc, state } = service();
    const result = await svc.createDraft(
      HOME_LEDGER_ID,
      OWNER_ID,
      dto({ type: 'INCOME', financialAccountId: HOME_ACCOUNT_ID, categoryId: HOME_CATEGORY_ID }),
    );
    expect(result.message).toBe('تم إنشاء المسودة بنجاح');
    expect(state.drafts).toHaveLength(1);
  });

  it('rejects an unknown transaction kind', async () => {
    const { svc } = service();
    const unsupportedKind = { ...dto(), type: 'REFUND' } as unknown as CreateDraftDto;
    await expect(svc.createDraft(LEDGER_ID, OWNER_ID, unsupportedKind)).rejects.toThrow(
      /INVALID_KIND/,
    );
  });

  it('rejects zero and negative amounts before touching the database', async () => {
    const { svc, prisma } = service();
    await expect(svc.createDraft(LEDGER_ID, OWNER_ID, dto({ amount: '0' }))).rejects.toThrow(
      'المبلغ يجب أن يكون أكبر من صفر',
    );
    await expect(svc.createDraft(LEDGER_ID, OWNER_ID, dto({ amount: '-5' }))).rejects.toThrow('المبلغ غير صالح');
    expect(prisma.draftTransaction.create).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown ledger', async () => {
    const { svc } = service();
    await expect(svc.createDraft(OTHER_LEDGER_ID, OWNER_ID, dto())).rejects.toThrow('الدفتر غير موجود');
  });
});

describe('TransactionsService transfer (TASK-031A)', () => {
  beforeEach(() => vi.clearAllMocks());

  const transferDto = (overrides: Partial<CreateDraftDto> = {}): CreateDraftDto =>
    dto({ type: 'TRANSFER', counterpartyAccountId: CPTY_ACCOUNT_ID, ...overrides });

  it('creates a TRANSFER draft with a counterparty account (default NONE transfer treatment)', async () => {
    const { svc, prisma, state } = service();
    const result = await svc.createDraft(LEDGER_ID, OWNER_ID, transferDto());
    expect(result.draft.kind).toBe('TRANSFER');
    expect(prisma.draftTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          counterpartyAccountId: CPTY_ACCOUNT_ID,
          transferTreatment: 'NONE',
        }),
      }),
    );
    expect(state.drafts[0].counterpartyAccountId).toBe(CPTY_ACCOUNT_ID);
  });

  it('refuses a transfer without a destination account', async () => {
    const { svc } = service();
    await expect(svc.createDraft(LEDGER_ID, OWNER_ID, transferDto({ counterpartyAccountId: undefined }))).rejects.toThrow(
      'حساب الوجهة غير صالح',
    );
  });

  it('refuses a transfer where source and destination are the same account', async () => {
    const { svc } = service();
    await expect(
      svc.createDraft(LEDGER_ID, OWNER_ID, transferDto({ counterpartyAccountId: ACCOUNT_ID })),
    ).rejects.toThrow('يجب أن يكونا مختلفين');
  });

  it('refuses a transfer whose destination lives in another ledger', async () => {
    const { svc } = service();
    await expect(
      svc.createDraft(LEDGER_ID, OWNER_ID, transferDto({ counterpartyAccountId: HOME_ACCOUNT_ID })),
    ).rejects.toThrow('حساب الوجهة غير صالح');
  });

  it('refuses a zero or negative transfer amount', async () => {
    const { svc, prisma } = service();
    await expect(svc.createDraft(LEDGER_ID, OWNER_ID, transferDto({ amount: '0' }))).rejects.toThrow(
      'المبلغ يجب أن يكون أكبر من صفر',
    );
    await expect(svc.createDraft(LEDGER_ID, OWNER_ID, transferDto({ amount: '-50' }))).rejects.toThrow(
      'المبلغ غير صالح',
    );
    expect(prisma.draftTransaction.create).not.toHaveBeenCalled();
  });

  it('hides a transfer destination that does not exist', async () => {
    const { svc } = service();
    await expect(
      svc.createDraft(LEDGER_ID, OWNER_ID, transferDto({ counterpartyAccountId: CATEGORY_ID })),
    ).rejects.toThrow('حساب الوجهة غير صالح');
  });

  it('refuses to confirm a confirmed but invalid transfer (destination in another ledger)', async () => {
    const { svc } = service({
      drafts: [
        makeDraft({
          status: 'DRAFT',
          kind: 'TRANSFER',
          counterpartyAccountId: HOME_ACCOUNT_ID,
          transferTreatment: 'NONE',
        }),
      ],
    });
    await expect(svc.confirmDraft(LEDGER_ID, DRAFT_ID, OWNER_ID)).rejects.toThrow('حساب الوجهة غير صالح');
  });

  it('posts two balanced journal lines: DEBIT destination / CREDIT source', async () => {
    const { svc, prisma, state } = service({
      drafts: [
        makeDraft({
          kind: 'TRANSFER',
          counterpartyAccountId: CPTY_ACCOUNT_ID,
          transferTreatment: 'NONE',
          lines: [
            {
              id: LINE_ID,
              direction: 'CREDIT',
              accountId: ACCOUNT_ID,
              categoryId: CATEGORY_ID,
              categoryItemId: null,
              amount: new Prisma.Decimal('1200'),
              baseAmount: new Prisma.Decimal('1200'),
              memo: null,
            },
          ],
        }),
      ],
    });

    const result = await svc.postDraft(LEDGER_ID, DRAFT_ID, OWNER_ID);
    expect(result.entryId).toBeTruthy();
    expect(state.entries).toHaveLength(1);
    expect(state.audit).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: 'POST', draftId: DRAFT_ID, entryId: result.entryId })]),
    );
    expect(prisma.journalLine.create).toHaveBeenCalledTimes(2);
    const journalLineCalls = vi.mocked(prisma.journalLine.create).mock.calls as Array<
      [{ data: Prisma.JournalLineUncheckedCreateInput }]
    >;
    const lines = journalLineCalls.map(([arg]) => arg.data);
    const debit = lines.find((l) => l.direction === 'DEBIT')!;
    const credit = lines.find((l) => l.direction === 'CREDIT')!;
    expect(debit.accountId).toBe(CPTY_ACCOUNT_ID);
    expect(credit.accountId).toBe(ACCOUNT_ID);
    expect(debit.amount.toString()).toBe(credit.amount.toString());
  });

  it('prevents posting the same transfer twice', async () => {
    const { svc, prisma } = service({
      drafts: [
        makeDraft({
          kind: 'TRANSFER',
          counterpartyAccountId: CPTY_ACCOUNT_ID,
          transferTreatment: 'NONE',
          postedEntryId: ENTRY_ID,
          lines: [
            {
              id: LINE_ID,
              direction: 'CREDIT',
              accountId: ACCOUNT_ID,
              categoryId: CATEGORY_ID,
              categoryItemId: null,
              amount: new Prisma.Decimal('1200'),
              baseAmount: new Prisma.Decimal('1200'),
              memo: null,
            },
          ],
        }),
      ],
    });
    await expect(svc.postDraft(LEDGER_ID, DRAFT_ID, OWNER_ID)).rejects.toThrow(
      'تم اعتماد هذه المسودة مسبقًا',
    );
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });

  it('requires ENTRY_CREATE to create a transfer draft', async () => {
    const { svc, prisma } = service({ memberPermissions: [] });
    await expect(svc.createDraft(LEDGER_ID, MEMBER_ID, transferDto())).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.draftTransaction.create).not.toHaveBeenCalled();
  });

  it('requires ENTRY_POST to post a confirmed transfer', async () => {
    const { svc, prisma } = service({
      drafts: [
        makeDraft({
          kind: 'TRANSFER',
          counterpartyAccountId: CPTY_ACCOUNT_ID,
          transferTreatment: 'NONE',
        }),
      ],
      memberPermissions: [{ permission: 'ENTRY_CONFIRM', revokedAt: null }],
    });
    await expect(svc.postDraft(LEDGER_ID, DRAFT_ID, MEMBER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });
});

describe('TransactionsService contact linking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a cash sale without a contact', async () => {
    const { svc, prisma } = service();
    const result = await svc.createDraft(LEDGER_ID, OWNER_ID, dto({ type: 'SALE_CASH' }));
    expect(result.draft.kind).toBe('SALE_CASH');
    expect(prisma.draftTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ contactId: null }) }),
    );
  });

  it('allows an optional customer on a cash sale', async () => {
    const { svc, prisma } = service();
    await svc.createDraft(LEDGER_ID, OWNER_ID, dto({ type: 'SALE_CASH', contactId: CUSTOMER_ID }));
    expect(prisma.draftTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ contactId: CUSTOMER_ID }) }),
    );
    expect(prisma.contact.findUnique).toHaveBeenCalledWith({ where: { id: CUSTOMER_ID } });
  });

  it('records a cash purchase without a contact', async () => {
    const { svc, prisma } = service();
    const result = await svc.createDraft(LEDGER_ID, OWNER_ID, dto({ type: 'PURCHASE_CASH' }));
    expect(result.draft.kind).toBe('PURCHASE_CASH');
    expect(prisma.draftLine.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ direction: 'DEBIT' }) }),
    );
  });

  it('links a credit sale to a customer', async () => {
    const { svc, prisma } = service();
    const result = await svc.createDraft(LEDGER_ID, OWNER_ID, dto({ type: 'SALE_CREDIT', contactId: CUSTOMER_ID }));
    expect(result.draft.contactId).toBe(CUSTOMER_ID);
    expect(prisma.draftLine.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ direction: 'CREDIT' }) }),
    );
  });

  it('links a credit purchase to a supplier (schema spelling SUPPLER)', async () => {
    const { svc, prisma } = service();
    const result = await svc.createDraft(
      LEDGER_ID,
      OWNER_ID,
      dto({ type: 'PURCHASE_CREDIT', contactId: SUPPLIER_ID }),
    );
    expect(result.draft.contactId).toBe(SUPPLIER_ID);
    expect(prisma.contact.findUnique).toHaveBeenCalledWith({ where: { id: SUPPLIER_ID } });
  });

  it('refuses a credit sale without a customer', async () => {
    const { svc } = service();
    await expect(svc.createDraft(LEDGER_ID, OWNER_ID, dto({ type: 'SALE_CREDIT' }))).rejects.toThrow(
      /CONTACT_REQUIRED/,
    );
  });

  it('refuses a credit purchase without a supplier', async () => {
    const { svc } = service();
    await expect(svc.createDraft(LEDGER_ID, OWNER_ID, dto({ type: 'PURCHASE_CREDIT' }))).rejects.toThrow(
      /CONTACT_REQUIRED/,
    );
  });

  it('refuses to link a sale to a supplier', async () => {
    const { svc } = service();
    await expect(
      svc.createDraft(LEDGER_ID, OWNER_ID, dto({ type: 'SALE_CREDIT', contactId: SUPPLIER_ID })),
    ).rejects.toThrow(/CONTACT_KIND_MISMATCH/);
  });

  it('refuses to link a purchase to a customer', async () => {
    const { svc } = service();
    await expect(
      svc.createDraft(LEDGER_ID, OWNER_ID, dto({ type: 'PURCHASE_CREDIT', contactId: CUSTOMER_ID })),
    ).rejects.toThrow(/CONTACT_KIND_MISMATCH/);
  });

  it('refuses a contact that belongs to another ledger', async () => {
    const { svc } = service();
    await expect(
      svc.createDraft(LEDGER_ID, OWNER_ID, dto({ type: 'SALE_CREDIT', contactId: FOREIGN_ID })),
    ).rejects.toThrow('جهة الاتصال غير موجودة');
  });

  it('refuses an archived contact', async () => {
    const { svc } = service();
    await expect(
      svc.createDraft(LEDGER_ID, OWNER_ID, dto({ type: 'SALE_CREDIT', contactId: ARCHIVED_ID })),
    ).rejects.toThrow(/CONTACT_ARCHIVED/);
  });

  it('exposes the linked contact in the review block', async () => {
    const { svc } = service();
    const result = await svc.createDraft(LEDGER_ID, OWNER_ID, dto({ type: 'SALE_CREDIT', contactId: CUSTOMER_ID }));
    expect(result.review.typeAr).toBe('بيع آجل');
    expect(result.review.contact).toMatchObject({ id: CUSTOMER_ID, kind: 'CUSTOMER' });
  });
});

describe('TransactionsService permissions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires ENTRY_CREATE to create a draft', async () => {
    const { svc } = service({ memberPermissions: [] });
    await expect(svc.createDraft(LEDGER_ID, MEMBER_ID, dto({ type: 'SALE_CASH' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('requires ENTRY_CONFIRM to confirm a draft', async () => {
    const { svc } = service({
      drafts: [makeDraft({ status: 'DRAFT' })],
      memberPermissions: [{ permission: 'ENTRY_CREATE', revokedAt: null }],
    });
    await expect(svc.confirmDraft(LEDGER_ID, DRAFT_ID, MEMBER_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires ENTRY_POST to post a confirmed draft', async () => {
    const { svc } = service({
      drafts: [makeDraft({ status: 'CONFIRMED' })],
      memberPermissions: [{ permission: 'ENTRY_CONFIRM', revokedAt: null }],
    });
    await expect(svc.postDraft(LEDGER_ID, DRAFT_ID, MEMBER_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('TransactionsService draft lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs Draft → Confirm → Post and links the contact on the posted entry', async () => {
    const { svc, prisma, state } = service();

    const created = await svc.createDraft(
      LEDGER_ID,
      OWNER_ID,
      dto({ type: 'SALE_CREDIT', contactId: CUSTOMER_ID, amount: '1200' }),
    );
    expect(created.draft.status).toBe('DRAFT');

    await svc.confirmDraft(LEDGER_ID, DRAFT_ID, OWNER_ID);
    expect(state.drafts[0].status).toBe('CONFIRMED');

    const posted = await svc.postDraft(LEDGER_ID, DRAFT_ID, OWNER_ID);
    expect(posted.entryId).toBe(ENTRY_ID);

    expect(prisma.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'SALE_CREDIT',
          status: 'POSTED',
          contactId: CUSTOMER_ID,
        }),
      }),
    );
    const entry = state.entries[0];
    expect(entry.status).toBe('POSTED');
    expect(entry.contactId).toBe(CUSTOMER_ID);
    expect('delete' in prisma.journalEntry).toBe(false);
    expect(state.drafts[0].status).toBe('POSTED');
    expect(state.drafts[0].postedEntryId).toBe(ENTRY_ID);
  });

  it('opens a RECEIVABLE debt when a credit sale is posted', async () => {
    const { svc, state } = service({
      drafts: [makeDraft({ status: 'CONFIRMED', kind: 'SALE_CREDIT', contactId: CUSTOMER_ID })],
    });
    await svc.postDraft(LEDGER_ID, DRAFT_ID, OWNER_ID);
    expect(state.debts).toHaveLength(1);
    expect(state.debts[0]).toMatchObject({
      direction: 'RECEIVABLE',
      status: 'OPEN',
      contactId: CUSTOMER_ID,
      sourceEntryId: ENTRY_ID,
    });
  });

  it('opens a PAYABLE debt when a credit purchase is posted', async () => {
    const { svc, state } = service({
      drafts: [makeDraft({ status: 'CONFIRMED', kind: 'PURCHASE_CREDIT', contactId: SUPPLIER_ID })],
    });
    await svc.postDraft(LEDGER_ID, DRAFT_ID, OWNER_ID);
    expect(state.debts[0]).toMatchObject({ direction: 'PAYABLE', status: 'OPEN', contactId: SUPPLIER_ID });
  });

  it('opens no debt for cash kinds', async () => {
    const { svc, state } = service({
      drafts: [makeDraft({ status: 'CONFIRMED', kind: 'SALE_CASH', contactId: null })],
    });
    await svc.postDraft(LEDGER_ID, DRAFT_ID, OWNER_ID);
    expect(state.debts).toHaveLength(0);
  });

  it('applies an optional dueDate to the debt opened at post time', async () => {
    const { svc, state } = service({
      drafts: [makeDraft({ status: 'CONFIRMED', kind: 'SALE_CREDIT', contactId: CUSTOMER_ID })],
    });
    await svc.postDraft(LEDGER_ID, DRAFT_ID, OWNER_ID, '2026-11-01');
    expect((state.debts[0] as { dueDate: Date }).dueDate.getTime()).toBe(Date.parse('2026-11-01T00:00:00.000Z'));
  });

  it('rejects an invalid dueDate', async () => {
    const { svc } = service({
      drafts: [makeDraft({ status: 'CONFIRMED', kind: 'SALE_CREDIT', contactId: CUSTOMER_ID })],
    });
    await expect(svc.postDraft(LEDGER_ID, DRAFT_ID, OWNER_ID, '01-11-2026')).rejects.toThrow('dueDate غير صالح');
  });

  it('refuses to post the same draft twice', async () => {
    const { svc } = service({ drafts: [makeDraft({ status: 'CONFIRMED', postedEntryId: ENTRY_ID })] });
    await expect(svc.postDraft(LEDGER_ID, DRAFT_ID, OWNER_ID)).rejects.toThrow('تم اعتماد هذه المسودة مسبقًا');
  });

  it('refuses to post a draft that is not confirmed yet', async () => {
    const { svc } = service({ drafts: [makeDraft({ status: 'DRAFT' })] });
    await expect(svc.postDraft(LEDGER_ID, DRAFT_ID, OWNER_ID)).rejects.toThrow('يجب تأكيد المسودة قبل الاعتماد');
  });

  it('refuses a commercial draft on a HOUSEHOLD ledger at confirm time too', async () => {
    const { svc } = service({
      drafts: [makeDraft({ status: 'DRAFT', ledgerId: HOME_LEDGER_ID })],
    });
    await expect(svc.confirmDraft(HOME_LEDGER_ID, DRAFT_ID, OWNER_ID)).rejects.toThrow(/LEDGER_NOT_BUSINESS/);
  });
});

describe('TransactionsService stock integration (TASK-025)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('links a product and quantity on a purchase draft', async () => {
    const { svc, prisma } = service({
      products: [makeProduct()],
      warehouses: [makeWarehouse()],
    });
    const result = await svc.createDraft(
      LEDGER_ID,
      OWNER_ID,
      dto({ type: 'PURCHASE_CASH', productId: PRODUCT_ID, quantity: '10' }),
    );
    expect(prisma.draftTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ productId: PRODUCT_ID }),
      }),
    );
    expect(result.review.product).toMatchObject({ id: PRODUCT_ID, kind: 'GOOD', trackStock: true });
    expect(result.review.quantity).toBe('10.000000');
  });

  it('refuses to link a product to a non-commercial kind', async () => {
    const { svc } = service({ products: [makeProduct()] });
    await expect(
      svc.createDraft(LEDGER_ID, OWNER_ID, dto({ type: 'INCOME', productId: PRODUCT_ID, quantity: '1' })),
    ).rejects.toThrow(/INVALID_KIND/);
  });

  it('refuses a product when the ledger has stock disabled', async () => {
    const { svc } = service({ products: [makeProduct()], stockEnabled: false });
    await expect(
      svc.createDraft(LEDGER_ID, OWNER_ID, dto({ type: 'SALE_CASH', productId: PRODUCT_ID, quantity: '1' })),
    ).rejects.toThrow(/FEATURE_DISABLED/);
  });

  it('refuses a product from another ledger', async () => {
    const { svc } = service({
      products: [makeProduct({ id: FOREIGN_PRODUCT_ID, ledgerId: OTHER_LEDGER_ID })],
    });
    await expect(
      svc.createDraft(LEDGER_ID, OWNER_ID, dto({ type: 'SALE_CASH', productId: FOREIGN_PRODUCT_ID, quantity: '1' })),
    ).rejects.toThrow(/PRODUCT_NOT_FOUND/);
  });

  it('requires a quantity when a product is linked', async () => {
    const { svc } = service({ products: [makeProduct()] });
    await expect(
      svc.createDraft(LEDGER_ID, OWNER_ID, dto({ type: 'SALE_CASH', productId: PRODUCT_ID })),
    ).rejects.toThrow('الكمية مطلوب');
  });

  it('posts a purchase as a positive stock movement at the unit cost', async () => {
    const { svc, state } = service({
      drafts: [makeDraft({ kind: 'PURCHASE_CASH', productId: PRODUCT_ID, quantity: new Prisma.Decimal('10'), baseAmount: new Prisma.Decimal('1000') })],
      products: [makeProduct()],
      warehouses: [makeWarehouse()],
    });
    await svc.postDraft(LEDGER_ID, DRAFT_ID, OWNER_ID);
    expect(state.stockMovements).toHaveLength(1);
    expect(state.stockMovements[0]).toMatchObject({ type: 'PURCHASE', entryId: ENTRY_ID });
    expect(state.stockMovements[0].quantity.toFixed(6)).toBe('10.000000');
    expect(state.stockMovements[0].unitCost?.toFixed(4)).toBe('100.0000');
  });

  it('values a sale with WAC from prior purchases and records COGS on the movement', async () => {
    const { svc, state } = service({
      drafts: [makeDraft({ kind: 'SALE_CASH', productId: PRODUCT_ID, quantity: new Prisma.Decimal('4'), baseAmount: new Prisma.Decimal('800') })],
      products: [makeProduct()],
      warehouses: [makeWarehouse()],
      stockMovements: [
        {
          id: STOCK_MOVEMENT_ID,
          ledgerId: LEDGER_ID,
          productId: PRODUCT_ID,
          warehouseId: WAREHOUSE_ID,
          type: 'PURCHASE',
          quantity: new Prisma.Decimal('10'),
          unitCost: new Prisma.Decimal('50'),
          entryId: ENTRY_ID,
          businessDate: new Date('2026-10-01T00:00:00Z'),
          note: null,
        },
      ],
    });
    await svc.postDraft(LEDGER_ID, DRAFT_ID, OWNER_ID);
    const sale = state.stockMovements.find((m) => m.type === 'SALE')!;
    expect(sale.quantity.toFixed(6)).toBe('-4.000000');
    expect(sale.unitCost?.toFixed(4)).toBe('50.0000');
  });

  it('refuses a sale that exceeds the available balance', async () => {
    const { svc } = service({
      drafts: [makeDraft({ kind: 'SALE_CASH', productId: PRODUCT_ID, quantity: new Prisma.Decimal('5') })],
      products: [makeProduct()],
      warehouses: [makeWarehouse()],
    });
    await expect(svc.postDraft(LEDGER_ID, DRAFT_ID, OWNER_ID)).rejects.toThrow(/INSUFFICIENT_STOCK/);
  });

  it('records no stock movement for a service product', async () => {
    const { svc, state } = service({
      drafts: [makeDraft({ kind: 'SALE_CASH', productId: SERVICE_PRODUCT_ID, quantity: new Prisma.Decimal('1') })],
      products: [makeProduct({ id: SERVICE_PRODUCT_ID, kind: 'SERVICE', trackStock: false })],
      warehouses: [makeWarehouse()],
    });
    await svc.postDraft(LEDGER_ID, DRAFT_ID, OWNER_ID);
    expect(state.stockMovements).toHaveLength(0);
  });

  it('never deletes stock movements', async () => {
    const { prisma } = service();
    expect('delete' in prisma.stockMovement).toBe(false);
    expect('deleteMany' in prisma.stockMovement).toBe(false);
  });
});
