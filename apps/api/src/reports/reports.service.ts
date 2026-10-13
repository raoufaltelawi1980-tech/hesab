import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { REPORT_ERROR_CODES } from './reports.errors.js';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function money(value: Prisma.Decimal | null | undefined): string {
  return value === null || value === undefined ? '0.0000' : value.toFixed(4);
}

function parseDateParam(raw: unknown, field: string): Date {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new BadRequestException(field + "  ");
  }
  const text = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new BadRequestException(REPORT_ERROR_CODES.INVALID_DATE + ":    ");
  }
  const date = new Date(text + "T00:00:00.000Z");
  if (isNaN(date.getTime())) {
    throw new BadRequestException(REPORT_ERROR_CODES.INVALID_DATE + ":    ");
  }
  return date;
}

/**
 * Commercial operational-result classification. Kept next to the report so the
 * equation and the kind sets live in one place. `COLLECTION`/`PAYMENT` are
 * settlement movements of pre-existing debts and are deliberately absent, and
 * `TRANSFER` is not a result movement at all.
 */
const SALES_KINDS = ['SALE_CASH', 'SALE_CREDIT'] as const;
const PURCHASES_KINDS = ['PURCHASE_CASH', 'PURCHASE_CREDIT'] as const;
const OPERATING_EXPENSE_KINDS = ['EXPENSE'] as const;
const OTHER_INCOME_KINDS = ['INCOME'] as const;
const PNL_KINDS = [
  ...SALES_KINDS,
  ...PURCHASES_KINDS,
  ...OPERATING_EXPENSE_KINDS,
  ...OTHER_INCOME_KINDS,
] as const;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async gate(ledgerId: string, actorId: string, permission: 'REPORT_VIEW') {
    if (!isUuid(ledgerId)) throw new BadRequestException('معرّف الدفتر غير صالح');
    const ledger = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!ledger) throw new NotFoundException('الدفتر غير موجود');
    if (!(await this.can(ledger, actorId, permission))) {
      throw new ForbiddenException('لا تملك صلاحية تنفيذ هذه العملية');
    }
    return ledger;
  }

  private async can(
    ledger: { id: string; ownerId: string },
    actorId: string,
    permission: string,
  ): Promise<boolean> {
    if (ledger.ownerId === actorId) return true;
    const membership = await this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId: ledger.id, userId: actorId } },
      include: { permissions: true },
    });
    if (!membership) return false;
    return membership.permissions.some(
      (row: { revokedAt: Date | null; permission: string }) =>
        !row.revokedAt && row.permission === permission,
    );
  }

  private parseRange(query: { from?: string; to?: string }): { from: Date; to: Date } {
    const from = parseDateParam(query.from, 'from');
    const to = parseDateParam(query.to, 'to');
    if (from > to) {
      throw new BadRequestException(REPORT_ERROR_CODES.INVALID_RANGE + ": from لا يجب أن يتجاوز to");
    }
    return { from, to };
  }

  async summary(ledgerId: string, actorId: string, query: { from?: string; to?: string }) {
    const ledger = await this.gate(ledgerId, actorId, 'REPORT_VIEW');
    const { from, to } = this.parseRange(query);
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        ledgerId,
        status: 'POSTED',
        businessDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        kind: true,
        baseAmount: true,
        lines: {
          select: {
            baseAmount: true,
            direction: true,
          },
        },
      },
    });
    let totalIncome = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);
    let salesTotal = new Prisma.Decimal(0);
    let purchasesTotal = new Prisma.Decimal(0);
    let opExpense = new Prisma.Decimal(0);
    for (const entry of entries) {
      const kind = entry.kind;
      if (kind === 'INCOME' || kind === 'SALE_CASH' || kind === 'SALE_CREDIT' || kind === 'COLLECTION') {
        totalIncome = totalIncome.add(entry.baseAmount);
        if (kind === 'SALE_CASH' || kind === 'SALE_CREDIT') {
          salesTotal = salesTotal.add(entry.baseAmount);
        }
      }
      if (kind === 'EXPENSE' || kind === 'PURCHASE_CASH' || kind === 'PURCHASE_CREDIT' || kind === 'PAYMENT') {
        totalExpense = totalExpense.add(entry.baseAmount);
        if (kind === 'PURCHASE_CASH' || kind === 'PURCHASE_CREDIT') {
          purchasesTotal = purchasesTotal.add(entry.baseAmount);
        }
        if (kind === 'EXPENSE') {
          opExpense = opExpense.add(entry.baseAmount);
        }
      }
    }
    const net = totalIncome.minus(totalExpense);
    const netProfitLoss = net;
    return {
      ledgerId,
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      currency: ledger.baseCurrencyId ? ledger.baseCurrencyId : null,
      totalIncome: money(totalIncome),
      totalExpense: money(totalExpense),
      net: money(net),
      netProfitLoss: money(netProfitLoss),
      salesTotal: money(salesTotal),
      purchasesTotal: money(purchasesTotal),
      operatingExpense: money(opExpense),
      count: entries.length,
      generatedAt: new Date().toISOString(),
    };
  }

  async timeseries(ledgerId: string, actorId: string, query: { from?: string; to?: string }) {
    const ledger = await this.gate(ledgerId, actorId, 'REPORT_VIEW');
    const { from, to } = this.parseRange(query);
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        ledgerId,
        status: 'POSTED',
        businessDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        kind: true,
        baseAmount: true,
        businessDate: true,
      },
    });
    const bucket = new Map<string, { income: Prisma.Decimal; expense: Prisma.Decimal; count: number }>();
    for (const entry of entries) {
      const key = entry.businessDate.toISOString().slice(0, 10);
      if (!bucket.has(key)) {
        bucket.set(key, {
          income: new Prisma.Decimal(0),
          expense: new Prisma.Decimal(0),
          count: 0,
        });
      }
      const b = bucket.get(key)!;
      if (entry.kind === 'INCOME' || entry.kind === 'SALE_CASH' || entry.kind === 'SALE_CREDIT' || entry.kind === 'COLLECTION') {
        b.income = b.income.add(entry.baseAmount);
      }
      if (entry.kind === 'EXPENSE' || entry.kind === 'PURCHASE_CASH' || entry.kind === 'PURCHASE_CREDIT' || entry.kind === 'PAYMENT') {
        b.expense = b.expense.add(entry.baseAmount);
      }
      b.count += 1;
    }
    const items = Array.from(bucket.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, v]) => ({
        period,
        income: money(v.income),
        expense: money(v.expense),
        net: money(v.income.minus(v.expense)),
        count: v.count,
      }));
    return {
      ledgerId,
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      currency: ledger.baseCurrencyId ? ledger.baseCurrencyId : null,
      items,
    };
  }

  async categories(ledgerId: string, actorId: string, query: { from?: string; to?: string }) {
    const ledger = await this.gate(ledgerId, actorId, 'REPORT_VIEW');
    const { from, to } = this.parseRange(query);
    const lines = await this.prisma.journalLine.findMany({
      where: {
        ledgerId,
        entry: {
          status: 'POSTED',
          businessDate: { gte: from, lte: to },
        },
      },
      select: {
        baseAmount: true,
        direction: true,
        categoryId: true,
        categoryItemId: true,
        category: { select: { id: true, name: true } },
        categoryItem: { select: { id: true, name: true } },
        entry: { select: { id: true, kind: true } },
      },
    });
    const bucket = new Map<string, { income: Prisma.Decimal; expense: Prisma.Decimal; count: number }>();
    const totalIncomeAll = lines.reduce((s, l) => {
      if (l.direction === 'CREDIT') return s.add(l.baseAmount);
      return s;
    }, new Prisma.Decimal(0));
    const totalExpenseAll = lines.reduce((s, l) => {
      if (l.direction === 'DEBIT') return s.add(l.baseAmount);
      return s;
    }, new Prisma.Decimal(0));
    for (const line of lines) {
      const key = line.categoryId ? (line.categoryItemId ? line.categoryId + ":" + line.categoryItemId : line.categoryId) : 'none';
      if (!bucket.has(key)) {
        bucket.set(key, {
          income: new Prisma.Decimal(0),
          expense: new Prisma.Decimal(0),
          count: 0,
        });
      }
      const b = bucket.get(key)!;
      if (line.direction === 'CREDIT') {
        b.income = b.income.add(line.baseAmount);
      } else {
        b.expense = b.expense.add(line.baseAmount);
      }
      b.count += 1;
    }
    const items = Array.from(bucket.entries()).map(([key, v]) => {
      let categoryId: string | null = null;
      let categoryItemId: string | null = null;
      let catName: string | null = null;
      let itemName: string | null = null;
      const [c, ci] = key.split(':');
      if (key === 'none') {
        categoryId = null;
      } else if (ci) {
        categoryId = c;
        categoryItemId = ci;
        // find names from first matching
        const found = lines.find((x) => x.categoryItemId === ci && x.categoryId === c);
        catName = found?.category?.name ?? null;
        itemName = found?.categoryItem?.name ?? null;
      } else {
        categoryId = c;
        const found = lines.find((x) => x.categoryId === c && !x.categoryItemId);
        catName = found?.category?.name ?? (lines.find((x) => x.categoryId === c)?.category?.name ?? null);
        itemName = null;
      }
      const net = v.income.minus(v.expense);
      const denom = v.income.gt(0) ? totalIncomeAll : (v.expense.gt(0) ? totalExpenseAll : new Prisma.Decimal(0));
      let percentOfTotal = new Prisma.Decimal(0);
      if (denom.gt(0)) {
        const base = v.income.gt(v.expense) ? v.income : v.expense;
        percentOfTotal = base.mul(100).div(denom);
      }
      return {
        categoryId,
        categoryName: catName,
        categoryItemId,
        categoryItemName: itemName,
        income: money(v.income),
        expense: money(v.expense),
        net: money(net),
        count: v.count,
        percentOfTotal: percentOfTotal.toFixed(2),
      };
    });
    return {
      ledgerId,
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      currency: ledger.baseCurrencyId ? ledger.baseCurrencyId : null,
      items,
    };
  }

  async accounts(ledgerId: string, actorId: string, query: { from?: string; to?: string }) {
    const ledger = await this.gate(ledgerId, actorId, 'REPORT_VIEW');
    const { from, to } = this.parseRange(query);
    const lines = await this.prisma.journalLine.findMany({
      where: {
        ledgerId,
        entry: {
          status: 'POSTED',
          businessDate: { gte: from, lte: to },
        },
      },
      select: {
        baseAmount: true,
        direction: true,
        accountId: true,
        account: { select: { id: true, name: true, currencyId: true, currency: { select: { code: true } } } },
      },
    });
    const bucket = new Map<string, { income: Prisma.Decimal; expense: Prisma.Decimal; count: number }>();
    for (const line of lines) {
      const key = line.accountId ?? 'none';
      if (!bucket.has(key)) {
        bucket.set(key, {
          income: new Prisma.Decimal(0),
          expense: new Prisma.Decimal(0),
          count: 0,
        });
      }
      const b = bucket.get(key)!;
      if (line.direction === 'CREDIT') {
        b.income = b.income.add(line.baseAmount);
      } else {
        b.expense = b.expense.add(line.baseAmount);
      }
      b.count += 1;
    }
    const items = Array.from(bucket.entries()).map(([key, v]) => {
      let accountName: string | null = null;
      let currencyCode: string | null = null;
      let currencyId: string | null = null;
      if (key !== 'none') {
        const found = lines.find((x) => x.accountId === key);
        accountName = found?.account?.name ?? null;
        currencyId = found?.account?.currencyId ?? null;
        currencyCode = found?.account?.currency?.code ?? null;
      }
      const net = v.income.minus(v.expense);
      return {
        accountId: key === 'none' ? null : key,
        accountName,
        currencyId,
        currencyCode,
        income: money(v.income),
        expense: money(v.expense),
        net: money(net),
        count: v.count,
      };
    });
    return {
      ledgerId,
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      baseCurrency: ledger.baseCurrencyId ? ledger.baseCurrencyId : null,
      items,
    };
  }

  async budgetComparison(ledgerId: string, actorId: string, query: { from?: string; to?: string }) {
    const ledger = await this.gate(ledgerId, actorId, 'REPORT_VIEW');
    const { from, to } = this.parseRange(query);
    const budgets = await this.prisma.budget.findMany({
      where: { ledgerId, archivedAt: null },
      select: {
        id: true,
        name: true,
        flow: true,
        limitType: true,
        fixedAmount: true,
        percentValue: true,
        percentBasis: true,
        periodType: true,
        categoryId: true,
        categoryItemId: true,
      },
    });
    const budgetIds = budgets.map((b) => b.id);
    const periods = await this.prisma.budgetPeriod.findMany({
      where: {
        budgetId: { in: budgetIds.length ? budgetIds : ['00000000-0000-0000-0000-000000000000'] },
        periodStart: { gte: from },
        periodEnd: { lte: to },
      },
      select: {
        id: true,
        budgetId: true,
        periodType: true,
        periodStart: true,
        periodEnd: true,
        effectiveLimit: true,
      },
    });
    const items = [];
    for (const budget of budgets) {
      const period = periods.find((p) => p.budgetId === budget.id);
      let executed = new Prisma.Decimal(0);
      const lines = await this.prisma.journalLine.findMany({
        where: {
          ledgerId,
          categoryId: budget.categoryId ?? undefined,
          categoryItemId: budget.categoryItemId ?? undefined,
          entry: {
            status: 'POSTED',
            businessDate: period ? { gte: period.periodStart, lte: period.periodEnd } : { gte: from, lte: to },
            kind: { in: (budget.flow === 'EXPENSE' ? ['EXPENSE', 'PURCHASE_CASH', 'PURCHASE_CREDIT', 'PAYMENT'] : ['INCOME', 'SALE_CASH', 'SALE_CREDIT', 'COLLECTION']) },
          },
        },
        select: { baseAmount: true, direction: true },
      });
      for (const line of lines) {
        if (budget.flow === 'EXPENSE' && line.direction === 'DEBIT') {
          executed = executed.add(line.baseAmount);
        }
        if (budget.flow === 'INCOME' && line.direction === 'CREDIT') {
          executed = executed.add(line.baseAmount);
        }
      }
      let limit = new Prisma.Decimal(0);
      if (budget.limitType === 'FIXED_AMOUNT' && period) {
        limit = period.effectiveLimit;
      } else if (budget.limitType === 'PERCENTAGE' && budget.percentValue) {
        // compute basis in same window
        const basisLines = await this.prisma.journalLine.findMany({
          where: {
            ledgerId,
            entry: {
              status: 'POSTED',
              businessDate: period ? { gte: period.periodStart, lte: period.periodEnd } : { gte: from, lte: to },
              kind: { in: (budget.percentBasis === 'OF_TOTAL_INCOME' ? ['INCOME', 'SALE_CASH', 'SALE_CREDIT', 'COLLECTION'] : ['EXPENSE', 'PURCHASE_CASH', 'PURCHASE_CREDIT', 'PAYMENT']) },
            },
          },
          select: { baseAmount: true, direction: true },
        });
        let basis = new Prisma.Decimal(0);
        for (const l of basisLines) {
          if (budget.percentBasis === 'OF_TOTAL_INCOME' && l.direction === 'CREDIT') basis = basis.add(l.baseAmount);
          if (budget.percentBasis === 'OF_TOTAL_EXPENSE' && l.direction === 'DEBIT') basis = basis.add(l.baseAmount);
        }
        limit = basis.mul(budget.percentValue).div(100);
      }
      const remaining = limit.minus(executed);
      const percent = limit.gt(0) ? executed.div(limit).mul(100) : new Prisma.Decimal(0);
      let status: 'WITHIN' | 'NEAR' | 'OVER' = 'WITHIN';
      if (executed.gt(limit)) status = 'OVER';
      else if (limit.gt(0) && percent.gte(80)) status = 'NEAR';
      items.push({
        budgetId: budget.id,
        budgetName: budget.name,
        flow: budget.flow,
        period: period
          ? { from: period.periodStart.toISOString().slice(0, 10), to: period.periodEnd.toISOString().slice(0, 10) }
          : { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
        limitType: budget.limitType,
        limit: money(limit),
        executed: money(executed),
        remaining: money(remaining),
        percentUsed: percent.toFixed(2),
        status,
      });
    }
    return {
      ledgerId,
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      currency: ledger.baseCurrencyId ? ledger.baseCurrencyId : null,
      items,
    };
  }

  /**
   * Commercial operational result (ربح/خسارة حسب الحركات المرحّلة).
   *
   * Equation: `netResult = totalSales - totalPurchases - operatingExpenses`.
   * Only `POSTED` entries inside the window are read, reversal entries
   * (`reversalOfId != null`) are skipped so a reversal never counts as a new
   * movement, and each entry is classified once. `COLLECTION`/`PAYMENT` are
   * excluded on purpose: they settle debts already recognised by
   * `SALE_CREDIT`/`PURCHASE_CREDIT`, so counting them would double the flows.
   *
   * There is no inventory yet, so purchases stand in as a temporary direct
   * cost; this is intentionally labelled "operational result", not final
   * accounting profit (no COGS/stock valuation).
   */
  async profitLoss(ledgerId: string, actorId: string, query: { from?: string; to?: string }) {
    const ledger = await this.gate(ledgerId, actorId, 'REPORT_VIEW');
    if (ledger.type !== 'BUSINESS') {
      throw new ForbiddenException(
        REPORT_ERROR_CODES.LEDGER_NOT_BUSINESS + ': تقرير النتيجة التشغيلية متاح للدفتر التجاري فقط',
      );
    }
    const { from, to } = this.parseRange(query);

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        ledgerId,
        status: 'POSTED',
        reversalOfId: null,
        businessDate: { gte: from, lte: to },
        kind: { in: [...PNL_KINDS] },
      },
      select: { id: true, kind: true, baseAmount: true },
    });

    const sales = { cash: new Prisma.Decimal(0), credit: new Prisma.Decimal(0), count: 0 };
    const purchases = { cash: new Prisma.Decimal(0), credit: new Prisma.Decimal(0), count: 0 };
    const operatingExpenses = { total: new Prisma.Decimal(0), count: 0 };
    const otherIncome = { total: new Prisma.Decimal(0), count: 0 };

    for (const entry of entries) {
      switch (entry.kind) {
        case 'SALE_CASH':
          sales.cash = sales.cash.add(entry.baseAmount);
          sales.count += 1;
          break;
        case 'SALE_CREDIT':
          sales.credit = sales.credit.add(entry.baseAmount);
          sales.count += 1;
          break;
        case 'PURCHASE_CASH':
          purchases.cash = purchases.cash.add(entry.baseAmount);
          purchases.count += 1;
          break;
        case 'PURCHASE_CREDIT':
          purchases.credit = purchases.credit.add(entry.baseAmount);
          purchases.count += 1;
          break;
        case 'EXPENSE':
          operatingExpenses.total = operatingExpenses.total.add(entry.baseAmount);
          operatingExpenses.count += 1;
          break;
        case 'INCOME':
          otherIncome.total = otherIncome.total.add(entry.baseAmount);
          otherIncome.count += 1;
          break;
        default:
          break;
      }
    }

    const totalSales = sales.cash.add(sales.credit);
    const totalPurchases = purchases.cash.add(purchases.credit);
    const netResult = totalSales.minus(totalPurchases).minus(operatingExpenses.total);

    const date = (value: Date) => value.toISOString().slice(0, 10);
    return {
      ledgerId,
      ledgerType: 'BUSINESS',
      period: { from: date(from), to: date(to) },
      currency: ledger.baseCurrencyId ? ledger.baseCurrencyId : null,
      resultLabel: 'النتيجة التشغيلية للفترة (حسب الحركات المرحّلة)',
      basisNote:
        'يعتمد التقرير على القيود المرحّلة (POSTED) فقط، ولا يحتسب القيود المعكوسة. المشتريات تُعامَل كتكلفة مباشرة مؤقتة إلى حين تنفيذ المخزون وتكلفة البضاعة المباعة (لا مخزون في هذه المرحلة).',
      excludedNote: 'استُبعدت التحصيلات (COLLECTION) والمدفوعات (PAYMENT) لمنع احتساب تسويات الديون مرّة ثانية.',
      totalSales: money(totalSales),
      salesCount: sales.count,
      salesCash: money(sales.cash),
      salesCredit: money(sales.credit),
      totalPurchases: money(totalPurchases),
      purchasesCount: purchases.count,
      purchasesCash: money(purchases.cash),
      purchasesCredit: money(purchases.credit),
      operatingExpenses: money(operatingExpenses.total),
      expensesCount: operatingExpenses.count,
      otherIncome: money(otherIncome.total),
      otherIncomeCount: otherIncome.count,
      netResult: money(netResult),
      sections: [
        {
          key: 'SALES',
          label: 'إجمالي المبيعات',
          total: money(totalSales),
          count: sales.count,
          cash: money(sales.cash),
          credit: money(sales.credit),
        },
        {
          key: 'PURCHASES',
          label: 'إجمالي المشتريات',
          total: money(totalPurchases),
          count: purchases.count,
          cash: money(purchases.cash),
          credit: money(purchases.credit),
        },
        {
          key: 'OPERATING_EXPENSES',
          label: 'المصروفات التشغيلية',
          total: money(operatingExpenses.total),
          count: operatingExpenses.count,
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Gross profit for stocked goods (TASK-025): `totalSales - COGS`, where COGS
   * is read from `SALE` stock movements valued at WAC. Sales are the POSTED
   * `SALE_*` entries in the window (reversals skipped, as in `profitLoss`), so
   * service-only sales still count while carrying no COGS. The margin is only
   * meaningful with a positive sales denominator; otherwise it is `null`.
   */
  async grossProfit(ledgerId: string, actorId: string, query: { from?: string; to?: string }) {
    const ledger = await this.gate(ledgerId, actorId, 'REPORT_VIEW');
    if (ledger.type !== 'BUSINESS') {
      throw new ForbiddenException(
        REPORT_ERROR_CODES.LEDGER_NOT_BUSINESS + ': تقرير الربح الإجمالي متاح للدفتر التجاري فقط',
      );
    }
    const { from, to } = this.parseRange(query);

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        ledgerId,
        status: 'POSTED',
        reversalOfId: null,
        businessDate: { gte: from, lte: to },
        kind: { in: [...SALES_KINDS] },
      },
      select: { baseAmount: true },
    });
    let totalSales = new Prisma.Decimal(0);
    for (const entry of entries) totalSales = totalSales.add(entry.baseAmount);

    const movements = await this.prisma.stockMovement.findMany({
      where: { ledgerId, type: 'SALE', businessDate: { gte: from, lte: to } },
      select: { quantity: true, unitCost: true },
    });
    let cogs = new Prisma.Decimal(0);
    for (const movement of movements) {
      if (movement.unitCost === null) continue;
      cogs = cogs.add(movement.quantity.abs().mul(movement.unitCost));
    }

    const grossProfitValue = totalSales.minus(cogs);
    const marginPercent = totalSales.gt(0)
      ? grossProfitValue.mul(100).div(totalSales).toFixed(2)
      : null;

    const date = (value: Date) => value.toISOString().slice(0, 10);
    return {
      ledgerId,
      ledgerType: 'BUSINESS',
      period: { from: date(from), to: date(to) },
      currency: ledger.baseCurrencyId ? ledger.baseCurrencyId : null,
      resultLabel: 'الربح الإجمالي للفترة (تكلفة المتوسط المرجّح)',
      basisNote:
        'يُحتسب COGS من حركات البيع (SALE) المقيَّمة بالمتوسط المرجّح، وإجمالي المبيعات من القيود المرحّلة SALE_* دون المعكوسة. بيع الخدمات يرفع المبيعات دون تكلفة.',
      totalSales: money(totalSales),
      salesCount: entries.length,
      cogs: money(cogs),
      cogsMovements: movements.length,
      grossProfit: money(grossProfitValue),
      marginPercent,
      generatedAt: new Date().toISOString(),
    };
  }
}
