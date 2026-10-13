import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestException } from '@nestjs/common';
import { vi } from 'vitest';
import { ReportsService } from './reports.service.js';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      ledger: { findUnique: vi.fn() },
      ledgerMember: { findUnique: vi.fn() },
      journalEntry: { findMany: vi.fn() },
      stockMovement: { findMany: vi.fn() },
      category: { findMany: vi.fn() },
      account: { findMany: vi.fn() },
      budget: { findMany: vi.fn() },
      budgetEntry: { findMany: vi.fn() },
    };
    service = new ReportsService(prisma as any);
  });

  describe('summary', () => {
    it('computes summary for POSTED entries', async () => {
      prisma.ledger.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        ownerId: 'u1',
        baseCurrencyId: 'SAR',
      });
      prisma.journalEntry.findMany.mockResolvedValue([
        { id: 'e1', kind: 'INCOME', baseAmount: new Decimal(100), lines: [] },
        { id: 'e2', kind: 'EXPENSE', baseAmount: new Decimal(30), lines: [] },
      ]);
      const res = await service.summary(
        '550e8400-e29b-41d4-a716-446655440000',
        'u1',
        { from: '2025-01-01', to: '2025-01-31' },
      );
      expect(res.totalIncome.toString()).toMatch('100');
      expect(res.totalExpense.toString()).toMatch('30');
      expect(res.net.toString()).toMatch('70');
      expect(res.netProfitLoss.toString()).toMatch('70');
      expect(res.count).toBe(2);
      expect(res.currency).toBe('SAR');
      const call = prisma.journalEntry.findMany.mock.calls[0][0];
      expect(call.where.ledgerId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(call.where.status).toBe('POSTED');
      expect(call.where.businessDate).toBeDefined();
    });

    it('rejects invalid date format', async () => {
      prisma.ledger.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        ownerId: 'u1',
        baseCurrencyId: 'SAR',
      });
      await expect(
        service.summary('550e8400-e29b-41d4-a716-446655440000', 'u1', { from: 'not-a-date', to: '2025-01-31' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid range from>to', async () => {
      prisma.ledger.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        ownerId: 'u1',
        baseCurrencyId: 'SAR',
      });
      await expect(
        service.summary('550e8400-e29b-41d4-a716-446655440000', 'u1', { from: '2025-02-01', to: '2025-01-31' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('enforces REPORT_VIEW permission', async () => {
      prisma.ledger.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        ownerId: 'other',
        baseCurrencyId: 'SAR',
      });
      await expect(
        service.summary('550e8400-e29b-41d4-a716-446655440000', 'u1', { from: '2025-01-01', to: '2025-01-31' }),
      ).rejects.toThrow();
    });

    it('throws NotFound when ledger missing', async () => {
      prisma.ledger.findUnique.mockResolvedValue(null);
      await expect(
        service.summary('550e8400-e29b-41d4-a716-446655440000', 'u1', { from: '2025-01-01', to: '2025-01-31' }),
      ).rejects.toThrow();
    });
  });

  describe('profitLoss', () => {
    const LEDGER = '550e8400-e29b-41d4-a716-446655440000';
    const OTHER_LEDGER = '660e8400-e29b-41d4-a716-446655440000';
    const RANGE = { from: '2026-04-01', to: '2026-04-30' };

    const business = { id: LEDGER, ownerId: 'u1', type: 'BUSINESS', baseCurrencyId: 'IQD' };

    function useLedger(overrides: Record<string, unknown> = {}) {
      prisma.ledger.findUnique.mockResolvedValue({ ...business, ...overrides });
    }
    function entries(rows: Array<{ kind: string; baseAmount: string; id?: string }>) {
      prisma.journalEntry.findMany.mockResolvedValue(
        rows.map((row, index) => ({
          id: row.id ?? `e${index}`,
          kind: row.kind,
          baseAmount: new Decimal(row.baseAmount),
        })),
      );
    }
    const whereOf = () => prisma.journalEntry.findMany.mock.calls[0][0].where;

    it('allows a BUSINESS ledger', async () => {
      useLedger();
      entries([]);
      const res = await service.profitLoss(LEDGER, 'u1', RANGE);
      expect(res.ledgerType).toBe('BUSINESS');
      expect(res.currency).toBe('IQD');
      expect(res.period).toEqual(RANGE);
    });

    it('rejects a HOUSEHOLD (family) ledger with LEDGER_NOT_BUSINESS', async () => {
      useLedger({ type: 'HOUSEHOLD' });
      await expect(service.profitLoss(LEDGER, 'u1', RANGE)).rejects.toThrow(/LEDGER_NOT_BUSINESS/);
    });

    it('rejects a member without REPORT_VIEW', async () => {
      useLedger({ ownerId: 'other' });
      prisma.ledgerMember.findUnique.mockResolvedValue({
        permissions: [{ permission: 'ENTRY_VIEW', revokedAt: null }],
      });
      await expect(service.profitLoss(LEDGER, 'u1', RANGE)).rejects.toThrow();
    });

    it('counts SALE_CASH, SALE_CREDIT, PURCHASE_CASH, PURCHASE_CREDIT and EXPENSE', async () => {
      useLedger();
      entries([
        { kind: 'SALE_CASH', baseAmount: '1000' },
        { kind: 'SALE_CREDIT', baseAmount: '500' },
        { kind: 'PURCHASE_CASH', baseAmount: '200' },
        { kind: 'PURCHASE_CREDIT', baseAmount: '300' },
        { kind: 'EXPENSE', baseAmount: '400' },
      ]);
      const res = await service.profitLoss(LEDGER, 'u1', RANGE);
      expect(res.salesCash).toBe('1000.0000');
      expect(res.salesCredit).toBe('500.0000');
      expect(res.totalSales).toBe('1500.0000');
      expect(res.salesCount).toBe(2);
      expect(res.purchasesCash).toBe('200.0000');
      expect(res.purchasesCredit).toBe('300.0000');
      expect(res.totalPurchases).toBe('500.0000');
      expect(res.purchasesCount).toBe(2);
      expect(res.operatingExpenses).toBe('400.0000');
      expect(res.expensesCount).toBe(1);
    });

    it('excludes COLLECTION from sales and expenses', async () => {
      useLedger();
      entries([{ kind: 'COLLECTION', baseAmount: '9999' }]);
      const res = await service.profitLoss(LEDGER, 'u1', RANGE);
      expect(res.totalSales).toBe('0.0000');
      expect(res.operatingExpenses).toBe('0.0000');
      expect(res.salesCount).toBe(0);
      expect(res.expensesCount).toBe(0);
      expect(whereOf().kind.in).not.toContain('COLLECTION');
    });

    it('excludes PAYMENT from purchases and expenses', async () => {
      useLedger();
      entries([{ kind: 'PAYMENT', baseAmount: '9999' }]);
      const res = await service.profitLoss(LEDGER, 'u1', RANGE);
      expect(res.totalPurchases).toBe('0.0000');
      expect(res.operatingExpenses).toBe('0.0000');
      expect(res.purchasesCount).toBe(0);
      expect(whereOf().kind.in).not.toContain('PAYMENT');
    });

    it('reads POSTED entries only and skips reversal entries', async () => {
      useLedger();
      entries([]);
      await service.profitLoss(LEDGER, 'u1', RANGE);
      expect(whereOf().status).toBe('POSTED');
      expect(whereOf().reversalOfId).toBeNull();
      expect(whereOf().kind.in).not.toContain('TRANSFER');
    });

    it('filters by the from/to window', async () => {
      useLedger();
      entries([]);
      await service.profitLoss(LEDGER, 'u1', RANGE);
      const range = whereOf().businessDate;
      expect(range.gte.toISOString().slice(0, 10)).toBe('2026-04-01');
      expect(range.lte.toISOString().slice(0, 10)).toBe('2026-04-30');
    });

    it('rejects an invalid range', async () => {
      useLedger();
      await expect(
        service.profitLoss(LEDGER, 'u1', { from: '2026-04-30', to: '2026-04-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('computes the operational result with Decimal and no duplication', async () => {
      useLedger();
      entries([
        { kind: 'SALE_CASH', baseAmount: '1000.0001' },
        { kind: 'SALE_CREDIT', baseAmount: '0.0003' },
        { kind: 'PURCHASE_CASH', baseAmount: '0.0002' },
        { kind: 'PURCHASE_CREDIT', baseAmount: '0.0001' },
        { kind: 'EXPENSE', baseAmount: '0.0001' },
      ]);
      const res = await service.profitLoss(LEDGER, 'u1', RANGE);
      expect(res.totalSales).toBe('1000.0004');
      expect(res.totalPurchases).toBe('0.0003');
      expect(res.netResult).toBe('1000.0000');
      expect(res.salesCount).toBe(2);
    });

    it('reports generic INCOME separately without inflating sales', async () => {
      useLedger();
      entries([{ kind: 'INCOME', baseAmount: '250' }]);
      const res = await service.profitLoss(LEDGER, 'u1', RANGE);
      expect(res.totalSales).toBe('0.0000');
      expect(res.otherIncome).toBe('250.0000');
      expect(res.otherIncomeCount).toBe(1);
      expect(res.netResult).toBe('0.0000');
    });

    it('keeps the deterministic section order', async () => {
      useLedger();
      entries([]);
      const res = await service.profitLoss(LEDGER, 'u1', RANGE);
      expect(res.sections.map((section: { key: string }) => section.key)).toEqual([
        'SALES',
        'PURCHASES',
        'OPERATING_EXPENSES',
      ]);
    });

    it('isolates the query to the requested ledger', async () => {
      useLedger({ id: OTHER_LEDGER });
      entries([]);
      await service.profitLoss(OTHER_LEDGER, 'u1', RANGE);
      expect(whereOf().ledgerId).toBe(OTHER_LEDGER);
    });
  });

  describe('grossProfit', () => {
    const LEDGER = '550e8400-e29b-41d4-a716-446655440000';
    const RANGE = { from: '2026-04-01', to: '2026-04-30' };

    function useLedger(overrides: Record<string, unknown> = {}) {
      prisma.ledger.findUnique.mockResolvedValue({
        id: LEDGER,
        ownerId: 'u1',
        type: 'BUSINESS',
        baseCurrencyId: 'IQD',
        ...overrides,
      });
    }

    function sales(rows: Array<{ baseAmount: string }>) {
      prisma.journalEntry.findMany.mockResolvedValue(
        rows.map((row, index) => ({ id: `e${index}`, baseAmount: new Decimal(row.baseAmount) })),
      );
    }

    function stock(rows: Array<{ quantity: string; unitCost: string | null }>) {
      prisma.stockMovement.findMany.mockResolvedValue(
        rows.map((row, index) => ({
          id: `m${index}`,
          quantity: new Decimal(row.quantity),
          unitCost: row.unitCost === null ? null : new Decimal(row.unitCost),
        })),
      );
    }

    it('computes gross profit and margin from sales minus COGS', async () => {
      useLedger();
      sales([{ baseAmount: '1000' }]);
      stock([
        { quantity: '-5', unitCost: '100' },
        { quantity: '-2', unitCost: '100' },
      ]);
      const res = await service.grossProfit(LEDGER, 'u1', RANGE);
      expect(res.totalSales).toBe('1000.0000');
      expect(res.cogs).toBe('700.0000');
      expect(res.grossProfit).toBe('300.0000');
      expect(res.marginPercent).toBe('30.00');
      expect(res.salesCount).toBe(1);
      expect(res.cogsMovements).toBe(2);
    });

    it('returns a null margin when there are no sales', async () => {
      useLedger();
      sales([]);
      stock([]);
      const res = await service.grossProfit(LEDGER, 'u1', RANGE);
      expect(res.grossProfit).toBe('0.0000');
      expect(res.marginPercent).toBeNull();
    });

    it('counts service sales without COGS', async () => {
      useLedger();
      sales([{ baseAmount: '500' }]);
      stock([]);
      const res = await service.grossProfit(LEDGER, 'u1', RANGE);
      expect(res.cogs).toBe('0.0000');
      expect(res.grossProfit).toBe('500.0000');
      expect(res.marginPercent).toBe('100.00');
    });

    it('reads only POSTED sale entries and SALE movements', async () => {
      useLedger();
      sales([]);
      stock([]);
      await service.grossProfit(LEDGER, 'u1', RANGE);
      const entryWhere = prisma.journalEntry.findMany.mock.calls[0][0].where;
      expect(entryWhere.status).toBe('POSTED');
      expect(whereOf().reversalOfId).toBeNull();
      expect(whereOf().kind.in).toEqual(['SALE_CASH', 'SALE_CREDIT']);
      const stockWhere = prisma.stockMovement.findMany.mock.calls[0][0].where;
      expect(stockWhere.type).toBe('SALE');
      expect(stockWhere.ledgerId).toBe(LEDGER);
    });

    it('ignores movements without a unit cost', async () => {
      useLedger();
      sales([{ baseAmount: '500' }]);
      stock([{ quantity: '-5', unitCost: null }]);
      const res = await service.grossProfit(LEDGER, 'u1', RANGE);
      expect(res.cogs).toBe('0.0000');
      expect(res.grossProfit).toBe('500.0000');
    });

    it('refuses a non-BUSINESS ledger', async () => {
      useLedger({ type: 'HOUSEHOLD' });
      await expect(service.grossProfit(LEDGER, 'u1', RANGE)).rejects.toThrow(/LEDGER_NOT_BUSINESS/);
    });

    const whereOf = () => prisma.journalEntry.findMany.mock.calls[0][0].where;
  });
});
