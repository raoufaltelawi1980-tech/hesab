import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Permission, Prisma, type DebtStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CONTACT_KIND_BY_DIRECTION,
  DEBT_STATUSES,
  SETTLEABLE_STATUSES,
  SETTLEMENT_KIND_BY_DIRECTION,
  type DebtStatusLiteral,
} from './debts.constants.js';
import { DEBT_ERROR_CODES } from './debts.errors.js';
import { CreateAllocationDto } from './dto/create-allocation.dto.js';
import { ListDebtsDto } from './dto/list-debts.dto.js';
import { StatementQueryDto } from './dto/statement-query.dto.js';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type LedgerRow = { id: string; ownerId: string; type: string; baseCurrencyId: string };

interface ContactLite {
  id: string;
  name: string;
  kind: string;
  currencyId?: string | null;
}

interface EntryLite {
  id: string;
  sequenceNumber: number;
  kind: string;
  status: string;
  businessDate: Date;
  contactId: string | null;
  originalAmount: Prisma.Decimal | null;
  baseAmount: Prisma.Decimal;
}

interface AllocationRow {
  id: string;
  debtId: string;
  entryId: string;
  amount: Prisma.Decimal;
  baseAmount: Prisma.Decimal;
  allocatedAt: Date;
  reversalOfId: string | null;
  entry?: EntryLite | null;
}

interface DebtRow {
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
  contact?: ContactLite | null;
  allocations?: AllocationRow[];
  sourceEntry?: EntryLite | null;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Money never passes through `Number`: `Decimal(20,4)` keeps its exact scale. */
function money(value: Prisma.Decimal | null | undefined): string {
  return value === null || value === undefined ? '0.0000' : value.toFixed(4);
}

function positiveDecimal(raw: unknown, field: string): Prisma.Decimal {
  if (typeof raw !== 'string' && typeof raw !== 'number') throw new BadRequestException(`${field} مطلوب`);
  const text = String(raw).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) throw new BadRequestException(`${field} غير صالح`);
  const value = new Prisma.Decimal(text);
  if (value.lte(0)) throw new BadRequestException(`${field} يجب أن يكون أكبر من صفر`);
  return value;
}

function dayStart(raw: string, field: string): Date {
  if (!DATE_RE.test(raw)) throw new BadRequestException(`${field} غير صالح`);
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} غير صالح`);
  return date;
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class DebtsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The contract writes `SUPPLIER`; the schema stores `SUPPLER`. */
  private toApiKind(kind: string): string {
    return kind === 'CUSTOMER' ? 'CUSTOMER' : 'SUPPLIER';
  }

  /**
   * One gate for every route: the ledger must exist, the actor must hold the
   * requested permission, and the ledger must be a BUSINESS ledger. Permission
   * is checked before the ledger type so a stranger learns nothing.
   */
  private async gate(ledgerId: string, actorId: string, permission: Permission): Promise<LedgerRow> {
    if (!isUuid(ledgerId)) throw new BadRequestException('معرّف الدفتر غير صالح');
    const ledger = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!ledger) throw new BadRequestException('الدفتر غير موجود');
    if (!(await this.can(ledger, actorId, permission))) {
      throw new ForbiddenException('لا تملك صلاحية تنفيذ هذه العملية');
    }
    if (ledger.type !== 'BUSINESS') {
      throw new ForbiddenException(`${DEBT_ERROR_CODES.LEDGER_NOT_BUSINESS}: الديون متاحة للدفتر التجاري فقط`);
    }
    return ledger;
  }

  private async can(
    ledger: { id: string; ownerId: string },
    actorId: string,
    permission: Permission,
  ): Promise<boolean> {
    if (ledger.ownerId === actorId) return true;
    const membership = await this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId: ledger.id, userId: actorId } },
      include: { permissions: true },
    });
    if (!membership) return false;
    return membership.permissions.some(
      (row: { revokedAt: Date | null; permission: Permission }) =>
        !row.revokedAt && row.permission === permission,
    );
  }

  /** Scoped to the ledger; a debt from another ledger is reported as absent. */
  private async loadDebt(ledgerId: string, debtId: string): Promise<DebtRow> {
    if (!isUuid(debtId)) throw new BadRequestException('معرّف الدين غير صالح');
    const debt = await this.prisma.debt.findUnique({
      where: { id: debtId },
      include: { contact: true, sourceEntry: true, allocations: { include: { entry: true } } },
    });
    if (!debt || debt.ledgerId !== ledgerId) {
      throw new NotFoundException(`${DEBT_ERROR_CODES.DEBT_NOT_FOUND}: الدين غير موجود`);
    }
    return debt;
  }

  private serializeEntry(entry: EntryLite | null | undefined) {
    if (!entry) return undefined;
    return {
      id: entry.id,
      sequenceNumber: entry.sequenceNumber,
      kind: entry.kind,
      status: entry.status,
      businessDate: dateOnly(entry.businessDate),
    };
  }

  private serializeAllocation(allocation: AllocationRow) {
    return {
      id: allocation.id,
      debtId: allocation.debtId,
      entryId: allocation.entryId,
      amount: money(allocation.amount),
      baseAmount: money(allocation.baseAmount),
      allocatedAt: allocation.allocatedAt.toISOString(),
      reversalOfId: allocation.reversalOfId,
      entry: this.serializeEntry(allocation.entry),
    };
  }

  private serializeDebt(debt: DebtRow) {
    const remaining = debt.originalAmount.sub(debt.settledAmount);
    const baseRemaining = debt.baseAmount.sub(debt.baseSettledAmount);
    return {
      id: debt.id,
      ledgerId: debt.ledgerId,
      contactId: debt.contactId,
      direction: debt.direction,
      status: debt.status,
      description: debt.description,
      businessDate: dateOnly(debt.businessDate),
      dueDate: debt.dueDate ? dateOnly(debt.dueDate) : null,
      originalAmount: money(debt.originalAmount),
      settledAmount: money(debt.settledAmount),
      remainingAmount: money(remaining),
      currencyId: debt.currencyId,
      baseAmount: money(debt.baseAmount),
      baseSettledAmount: money(debt.baseSettledAmount),
      baseRemaining: money(baseRemaining),
      baseCurrencyId: debt.baseCurrencyId,
      exchangeRate: debt.exchangeRate === null ? null : debt.exchangeRate.toString(),
      sourceEntryId: debt.sourceEntryId,
      sourceEntry: this.serializeEntry(debt.sourceEntry),
      settledAt: debt.settledAt ? debt.settledAt.toISOString() : null,
      writtenOffAt: debt.writtenOffAt ? debt.writtenOffAt.toISOString() : null,
      reversalOfId: debt.reversalOfId,
      contact: debt.contact
        ? { id: debt.contact.id, name: debt.contact.name, kind: this.toApiKind(debt.contact.kind) }
        : undefined,
      allocations: debt.allocations ? debt.allocations.map((a) => this.serializeAllocation(a)) : undefined,
      createdAt: debt.createdAt.toISOString(),
      updatedAt: debt.updatedAt.toISOString(),
    };
  }

  async list(ledgerId: string, actorId: string, query: ListDebtsDto = {}) {
    await this.gate(ledgerId, actorId, Permission.ENTRY_VIEW);
    const where: Prisma.DebtWhereInput = { ledgerId };
    if (query.status && (DEBT_STATUSES as readonly string[]).includes(query.status)) {
      where.status = query.status as DebtStatus;
    }
    if (query.direction === 'RECEIVABLE' || query.direction === 'PAYABLE') {
      where.direction = query.direction;
    }
    if (query.contactId && isUuid(query.contactId)) where.contactId = query.contactId;
    const debts = await this.prisma.debt.findMany({
      where,
      include: { contact: true, sourceEntry: true, allocations: { include: { entry: true } } },
      orderBy: { businessDate: 'desc' },
    });
    return debts.map((debt: DebtRow) => this.serializeDebt(debt));
  }

  async get(ledgerId: string, debtId: string, actorId: string) {
    await this.gate(ledgerId, actorId, Permission.ENTRY_VIEW);
    return this.serializeDebt(await this.loadDebt(ledgerId, debtId));
  }

  /**
   * Allocates a posted collection/payment entry onto a debt. The entry is the
   * financial movement (created through the draft cycle); this records the link
   * and advances the debt's status. Nothing is ever deleted.
   */
  async allocate(ledgerId: string, debtId: string, actorId: string, dto: CreateAllocationDto) {
    await this.gate(ledgerId, actorId, Permission.ENTRY_CREATE);
    const amount = positiveDecimal(dto.amount, 'المبلغ');

    const debt = await this.loadDebt(ledgerId, debtId);
    if (!SETTLEABLE_STATUSES.includes(debt.status as DebtStatusLiteral)) {
      throw new BadRequestException(`${DEBT_ERROR_CODES.DEBT_CLOSED}: لا يمكن تسوية دين بحالة ${debt.status}`);
    }
    if (debt.contact && debt.contact.kind !== CONTACT_KIND_BY_DIRECTION[debt.direction]) {
      throw new BadRequestException(
        `${DEBT_ERROR_CODES.CONTACT_MISMATCH}: نوع جهة الاتصال لا يطابق اتجاه الدين`,
      );
    }

    const entry = await this.prisma.journalEntry.findUnique({ where: { id: dto.entryId } });
    if (!entry || entry.ledgerId !== ledgerId || entry.status !== 'POSTED') {
      throw new BadRequestException(`${DEBT_ERROR_CODES.ENTRY_NOT_POSTED}: القيد غير موجود أو غير معتمد`);
    }
    const expectedKind = SETTLEMENT_KIND_BY_DIRECTION[debt.direction];
    if (entry.kind !== expectedKind) {
      throw new BadRequestException(
        `${DEBT_ERROR_CODES.ENTRY_KIND_MISMATCH}: يجب استخدام قيد ${expectedKind} لتسوية هذا الدين`,
      );
    }
    if (entry.contactId !== debt.contactId) {
      throw new BadRequestException(`${DEBT_ERROR_CODES.CONTACT_MISMATCH}: القيد لا يخص جهة اتصال الدين`);
    }

    const remaining = debt.originalAmount.sub(debt.settledAmount);
    if (amount.gt(remaining)) {
      throw new BadRequestException(`${DEBT_ERROR_CODES.AMOUNT_EXCEEDS_BALANCE}: المبلغ أكبر من الرصيد المتبقي`);
    }

    const baseAmount = this.toBaseAmount(debt, amount);
    const remainingBase = debt.baseAmount.sub(debt.baseSettledAmount);
    if (baseAmount.gt(remainingBase)) {
      throw new BadRequestException(`${DEBT_ERROR_CODES.AMOUNT_EXCEEDS_BALANCE}: المبلغ أكبر من الرصيد المتبقي`);
    }

    await this.assertEntryNotOverAllocated(entry, amount, baseAmount);

    const settled = debt.settledAmount.add(amount);
    const baseSettled = debt.baseSettledAmount.add(baseAmount);
    const fullySettled = baseSettled.gte(debt.baseAmount) || settled.gte(debt.originalAmount);
    const status = fullySettled ? 'SETTLED' : 'PARTIALLY_SETTLED';

    await this.prisma.$transaction(async (tx) => {
      await tx.debtAllocation.create({
        data: { debtId: debt.id, entryId: entry.id, amount, baseAmount, allocatedAt: new Date() },
      });
      await tx.debt.update({
        where: { id: debt.id },
        data: {
          settledAmount: settled,
          baseSettledAmount: baseSettled,
          status,
          settledAt: fullySettled ? new Date() : null,
        },
      });
      await tx.transactionAuditLog.create({
        data: {
          ledgerId,
          entryId: entry.id,
          action: 'UPDATE',
          field: 'debt.settledAmount',
          payload: { debtId: debt.id, amount: money(amount), baseAmount: money(baseAmount) },
          actorId,
          createdAt: new Date(),
        },
      });
    });

    const updated = await this.loadDebt(ledgerId, debtId);
    return { message: 'تمت تسوية الدين', debt: this.serializeDebt(updated) };
  }

  /**
   * The base-currency value of an allocation. When the debt is already in the
   * ledger currency the amounts match; otherwise the debt's own ratio is used.
   */
  private toBaseAmount(debt: DebtRow, amount: Prisma.Decimal): Prisma.Decimal {
    if (debt.currencyId === debt.baseCurrencyId || debt.originalAmount.isZero()) return amount;
    return amount.mul(debt.baseAmount).div(debt.originalAmount).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  }

  /** A posted entry cannot allocate more than its own amount across debts. */
  private async assertEntryNotOverAllocated(entry: EntryLite, amount: Prisma.Decimal, baseAmount: Prisma.Decimal) {
    const existing = await this.prisma.debtAllocation.findMany({ where: { entryId: entry.id } });
    let allocated = new Prisma.Decimal(0);
    let baseAllocated = new Prisma.Decimal(0);
    for (const row of existing) {
      allocated = allocated.add(row.amount);
      baseAllocated = baseAllocated.add(row.baseAmount);
    }
    const entryAmount = entry.originalAmount ?? entry.baseAmount;
    if (allocated.add(amount).gt(entryAmount) || baseAllocated.add(baseAmount).gt(entry.baseAmount)) {
      throw new BadRequestException(`${DEBT_ERROR_CODES.ENTRY_OVER_ALLOCATED}: القيد مخصَّص بالكامل مسبقًا`);
    }
  }

  /**
   * A real, POSTED-only statement for one contact. Debts and their allocations
   * are scoped to the ledger and the contact; `from`/`to` narrow the movement
   * window by business date whenever the project's date fields allow it.
   */
  async statement(ledgerId: string, contactId: string, actorId: string, query: StatementQueryDto = {}) {
    const ledger = await this.gate(ledgerId, actorId, Permission.CONTACT_VIEW);
    if (!isUuid(contactId)) throw new BadRequestException('معرّف جهة الاتصال غير صالح');
    const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact || contact.ledgerId !== ledgerId) {
      throw new BadRequestException('جهة الاتصال غير موجودة');
    }

    const from = query.from ? dayStart(query.from, 'from') : undefined;
    const to = query.to ? dayStart(query.to, 'to') : undefined;
    if (from && to && from.getTime() > to.getTime()) throw new BadRequestException('المدى الزمني غير صالح');

    const debts = await this.prisma.debt.findMany({
      where: {
        ledgerId,
        contactId,
        ...(from || to ? { businessDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: { sourceEntry: true, allocations: { include: { entry: true } } },
      orderBy: { businessDate: 'asc' },
    });

    const rows = (debts as DebtRow[]).map((debt) => {
      const allocations = (debt.allocations ?? []).filter((a) => {
        if (!a.entry || a.entry.status !== 'POSTED') return false;
        if (from && a.entry.businessDate.getTime() < from.getTime()) return false;
        if (to && a.entry.businessDate.getTime() > to.getTime()) return false;
        return true;
      });
      return { ...debt, allocations };
    });

    let originalBase = new Prisma.Decimal(0);
    let settledBase = new Prisma.Decimal(0);
    for (const debt of rows) {
      originalBase = originalBase.add(debt.baseAmount);
      settledBase = settledBase.add(debt.baseSettledAmount);
    }
    const remainingBase = originalBase.sub(settledBase);

    return {
      contact: { id: contact.id, name: contact.name, kind: this.toApiKind(contact.kind), currencyId: contact.currencyId },
      baseCurrencyId: ledger.baseCurrencyId,
      range: { from: query.from ?? null, to: query.to ?? null },
      totals: {
        originalBase: money(originalBase),
        settledBase: money(settledBase),
        remainingBase: money(remainingBase),
      },
      debts: rows.map((debt) => this.serializeDebt(debt)),
    };
  }
}
