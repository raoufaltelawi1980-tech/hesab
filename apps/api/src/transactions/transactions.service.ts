import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Permission, Prisma, type Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockService } from '../inventory/stock.service.js';
import { INVENTORY_ERROR_CODES } from '../inventory/inventory.errors.js';
import { CreateDraftDto } from './dto/create-draft.dto.js';
import { UpdateDraftDto } from './dto/update-draft.dto.js';
import {
  debtDirectionForKind,
  entryDirection,
  isBusinessKind,
  isCommercialKind,
  isDebtOpeningKind,
  isDraftKind,
  isTransferKind,
  KIND_LABEL_AR,
  requiredContactKind,
} from './transactions.constants.js';
import { TRANSACTION_ERROR_CODES } from './transactions.errors.js';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Money never passes through `Number`: `Decimal(20,4)` keeps its exact scale. */
function positiveDecimal(raw: unknown, field: string): Prisma.Decimal {
  if (typeof raw !== 'string' && typeof raw !== 'number') throw new BadRequestException(`${field} مطلوب`);
  const text = String(raw).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) throw new BadRequestException(`${field} غير صالح`);
  const value = new Prisma.Decimal(text);
  if (value.lte(0)) throw new BadRequestException(`${field} يجب أن يكون أكبر من صفر`);
  return value;
}

function kindLabel(kind: string): string {
  return KIND_LABEL_AR[kind] ?? kind;
}

/** Parses an optional `YYYY-MM-DD` date (the shape Postgres `@db.Date` uses). */
function optionalDate(raw: unknown): Date | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new BadRequestException('dueDate غير صالح');
  }
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('dueDate غير صالح');
  return date;
}

type ContactLite = { id: string; kind: string; name: string };

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  private isUuid(v: string): boolean {
    try {
      return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
    } catch {
      return false;
    }
  }

  private async hasPerm(actorId: string, ledger: { id: string; ownerId: string }, perm: Permission): Promise<boolean> {
    if (ledger.ownerId === actorId) return true;
    const m = await this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId: ledger.id, userId: actorId } },
      include: { permissions: true },
    });
    if (!m) return false;
    return m.permissions.some((p) => !p.revokedAt && p.permission === perm);
  }

  /** Commercial and settlement kinds are a business-ledger feature. */
  private assertCommercialLedger(kind: string, ledgerType: string): void {
    if (isBusinessKind(kind) && ledgerType !== 'BUSINESS') {
      throw new ForbiddenException(
        `${TRANSACTION_ERROR_CODES.LEDGER_NOT_BUSINESS}: العمليات التجارية متاحة للدفتر التجاري فقط`,
      );
    }
  }

  /**
   * Resolves the optional link to a `Contact`. A sale only ever links a
   * customer and a purchase only ever a supplier; the credit kinds require it,
   * the cash kinds do not. The contact must live in the same ledger and must
   * not be archived.
   */
  private async resolveContact(ledgerId: string, kind: string, raw: unknown): Promise<ContactLite | null> {
    const required = requiredContactKind(kind);
    const provided = typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
    if (!provided) {
      if (required) {
        const wanted = required === 'CUSTOMER' ? 'عميلًا' : 'موردًا';
        throw new BadRequestException(
          `${TRANSACTION_ERROR_CODES.CONTACT_REQUIRED}: ${kindLabel(kind)} يتطلب ${wanted}`,
        );
      }
      return null;
    }
    if (!isUuid(provided)) throw new BadRequestException('معرّف جهة الاتصال غير صالح');
    const contact = await this.prisma.contact.findUnique({ where: { id: provided } });
    if (!contact || contact.ledgerId !== ledgerId) throw new BadRequestException('جهة الاتصال غير موجودة');
    if (contact.archivedAt) {
      throw new BadRequestException(
        `${TRANSACTION_ERROR_CODES.CONTACT_ARCHIVED}: لا يمكن استخدام جهة اتصال مؤرشفة`,
      );
    }
    if (required && contact.kind !== required) {
      const wanted = required === 'CUSTOMER' ? 'عميل' : 'مورد';
      throw new BadRequestException(
        `${TRANSACTION_ERROR_CODES.CONTACT_KIND_MISMATCH}: يجب ربط ${kindLabel(kind)} بـ${wanted} من نفس الدفتر`,
      );
    }
    return { id: contact.id, kind: contact.kind, name: contact.name };
  }

  /**
   * Resolves the optional link to a stocked `Product` (TASK-025). Only sale and
   * purchase drafts may link a product, the ledger must have `stockEnabled`,
   * and the product must live in the same ledger and not be archived. The
   * quantity is mandatory with a product and must be strictly positive.
   */
  private async resolveDraftStock(
    ledger: { stockEnabled: boolean },
    ledgerId: string,
    kind: string,
    rawProductId: unknown,
    rawQuantity: unknown,
  ): Promise<{ productId: string | null; quantity: Prisma.Decimal | null; product: Product | null }> {
    const provided =
      typeof rawProductId === 'string' && rawProductId.trim().length > 0 ? rawProductId.trim() : null;
    if (!provided) {
      const hasQuantity =
        (typeof rawQuantity === 'string' && rawQuantity.trim().length > 0) ||
        typeof rawQuantity === 'number';
      if (hasQuantity) {
        throw new BadRequestException('لا يمكن تحديد كمية دون ربط منتج');
      }
      return { productId: null, quantity: null, product: null };
    }
    if (!isCommercialKind(kind)) {
      throw new BadRequestException(
        `${TRANSACTION_ERROR_CODES.INVALID_KIND}: ربط المنتج متاح لعمليات البيع والشراء فقط`,
      );
    }
    if (!ledger.stockEnabled) {
      throw new ForbiddenException(
        `${INVENTORY_ERROR_CODES.FEATURE_DISABLED}: المخزون غير مفعّل في هذا الدفتر`,
      );
    }
    if (!isUuid(provided)) throw new BadRequestException('معرّف المنتج غير صالح');
    const product = await this.prisma.product.findUnique({ where: { id: provided } });
    if (!product || product.ledgerId !== ledgerId) {
      throw new BadRequestException(`${INVENTORY_ERROR_CODES.PRODUCT_NOT_FOUND}: المنتج غير موجود`);
    }
    if (product.archivedAt) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.PRODUCT_ARCHIVED}: لا يمكن استخدام منتج مؤرشف`,
      );
    }
    return { productId: product.id, quantity: positiveDecimal(rawQuantity, 'الكمية'), product };
  }

  async createDraft(
    ledgerId: string,
    actorId: string,
    dto: CreateDraftDto,
    options: { source?: 'MANUAL' | 'VOICE' } = {},
  ) {
    if (!this.isUuid(ledgerId)) throw new NotFoundException('الدفتر غير موجود');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('الدفتر غير موجود');
    if (!(await this.hasPerm(actorId, l, Permission.ENTRY_CREATE))) throw new ForbiddenException('لا تملك صلاحية تنفيذ هذه العملية');

    const kind = String(dto.type);
    if (!isDraftKind(kind)) {
      throw new BadRequestException(`${TRANSACTION_ERROR_CODES.INVALID_KIND}: نوع العملية غير صالح`);
    }
    this.assertCommercialLedger(kind, l.type);

    const amt = positiveDecimal(dto.amount, 'المبلغ');

    const acc = await this.prisma.financialAccount.findUnique({ where: { id: dto.financialAccountId } });
    const cat = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    const item = dto.categoryItemId
      ? await this.prisma.categoryItem.findUnique({ where: { id: dto.categoryItemId }, include: { category: true } })
      : null;
    const curr = await this.prisma.currency.findFirst({ where: { code: dto.currencyCode } });
    if (!acc || acc.ledgerId !== ledgerId || acc.archivedAt) throw new BadRequestException('الحساب غير صالح');
    if (!cat || cat.ledgerId !== ledgerId || cat.archivedAt) throw new BadRequestException('التصنيف غير صالح');
    if (dto.categoryItemId && (!item || item.categoryId !== cat.id || item.archivedAt)) {
      throw new BadRequestException('البند الفرعي غير صالح');
    }
    if (!curr) throw new BadRequestException('العملة غير صالحة');

    if (isTransferKind(kind)) {
      const cptyId = dto.counterpartyAccountId;
      if (!cptyId || !isUuid(cptyId)) throw new BadRequestException('حساب الوجهة غير صالح');
      if (cptyId === dto.financialAccountId) throw new BadRequestException('الحساب المصدر والوجهة يجب أن يكونا مختلفين');
      const cpty = await this.prisma.financialAccount.findUnique({ where: { id: cptyId } });
      if (!cpty || cpty.ledgerId !== ledgerId || cpty.archivedAt) throw new BadRequestException('حساب الوجهة غير صالح');
    }

    const contact = await this.resolveContact(ledgerId, kind, dto.contactId);
    const stock = await this.resolveDraftStock(l, ledgerId, kind, dto.productId, dto.quantity);

    const baseCurrId = l.baseCurrencyId;
    const rate = dto.exchangeRate ? positiveDecimal(dto.exchangeRate, 'سعر الصرف') : new Prisma.Decimal(1);
    const baseAmt = dto.amountBase ? positiveDecimal(dto.amountBase, 'المبلغ الأساسي') : amt.mul(rate);

    const draft = await this.prisma.draftTransaction.create({
      data: {
        ledgerId,
        kind,
        source: options.source ?? 'MANUAL',
        description: dto.description,
        occurredAt: dto.businessDate ? new Date(dto.businessDate) : new Date(),
        businessDate: dto.businessDate ? new Date(dto.businessDate) : new Date(),
        originalCurrencyId: curr.id,
        originalAmount: amt,
        baseAmount: baseAmt,
        baseCurrencyId: baseCurrId,
        contactId: contact?.id ?? null,
        productId: stock.productId,
        quantity: stock.quantity,
        createdById: actorId,
        status: 'DRAFT',
        counterpartyAccountId: isTransferKind(kind) ? dto.counterpartyAccountId : null,
        transferTreatment: isTransferKind(kind) ? 'NONE' : undefined,
      },
    });

    await this.prisma.draftLine.create({
      data: {
        draftId: draft.id,
        direction: entryDirection(kind),
        accountId: acc.id,
        categoryId: cat.id,
        categoryItemId: item?.id,
        amount: amt,
        baseAmount: baseAmt,
        memo: dto.description,
      },
    });

    return {
      message: 'تم إنشاء المسودة بنجاح',
      review: {
        message: 'يرجى مراجعة بيانات العملية قبل التأكيد',
        typeAr: kindLabel(draft.kind),
        amount: draft.originalAmount,
        currency: curr.code,
        account: acc.name,
        category: cat.name,
        categoryItem: item?.name,
        contact: contact ? { id: contact.id, name: contact.name, kind: contact.kind } : undefined,
        product: stock.product
          ? {
              id: stock.product.id,
              name: stock.product.name,
              kind: stock.product.kind,
              trackStock: stock.product.trackStock,
            }
          : undefined,
        quantity: stock.quantity ? stock.quantity.toFixed(6) : undefined,
        description: draft.description ?? undefined,
        businessDate: draft.businessDate,
      },
      draft,
    };
  }

  async listDrafts(ledgerId: string, actorId: string) {
    if (!this.isUuid(ledgerId)) throw new NotFoundException('الدفتر غير موجود');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('الدفتر غير موجود');
    if (!(await this.hasPerm(actorId, l, Permission.ENTRY_VIEW))) throw new ForbiddenException('لا تملك صلاحية تنفيذ هذه العملية');
    return this.prisma.draftTransaction.findMany({ where: { ledgerId }, include: { lines: true }, orderBy: { createdAt: 'desc' } });
  }

  async getDraft(ledgerId: string, draftId: string, actorId: string) {
    if (!this.isUuid(ledgerId) || !this.isUuid(draftId)) throw new NotFoundException('غير موجود');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('الدفتر غير موجود');
    if (!(await this.hasPerm(actorId, l, Permission.ENTRY_VIEW))) throw new ForbiddenException('لا تملك صلاحية تنفيذ هذه العملية');

    const d = await this.prisma.draftTransaction.findUnique({ where: { id: draftId }, include: { lines: true } });
    if (!d || d.ledgerId !== ledgerId) throw new NotFoundException('غير موجود');
    const line = d.lines[0];

    const [acc, cat, item, curr, contact] = await Promise.all([
      line && line.accountId ? this.prisma.financialAccount.findUnique({ where: { id: line.accountId } }) : null,
      line && line.categoryId ? this.prisma.category.findUnique({ where: { id: line.categoryId } }) : null,
      line && line.categoryItemId ? this.prisma.categoryItem.findUnique({ where: { id: line.categoryItemId } }) : null,
      this.prisma.currency.findUnique({ where: { id: d.originalCurrencyId } }),
      d.contactId ? this.prisma.contact.findUnique({ where: { id: d.contactId } }) : null,
    ]);

    return {
      draft: d,
      review: {
        message: 'يرجى مراجعة بيانات العملية قبل التأكيد',
        typeAr: kindLabel(d.kind),
        amount: d.originalAmount,
        currency: curr?.code ?? undefined,
        account: acc?.name ?? undefined,
        category: cat?.name ?? undefined,
        categoryItem: item?.name,
        contact: contact ? { id: contact.id, name: contact.name, kind: contact.kind } : undefined,
        description: d.description ?? undefined,
        businessDate: d.businessDate,
      },
    };
  }

  async updateDraft(ledgerId: string, draftId: string, actorId: string, dto: UpdateDraftDto) {
    if (!this.isUuid(ledgerId) || !this.isUuid(draftId)) throw new NotFoundException('غير موجود');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('الدفتر غير موجود');
    if (!(await this.hasPerm(actorId, l, Permission.ENTRY_CREATE))) throw new ForbiddenException('لا تملك صلاحية تنفيذ هذه العملية');

    const d = await this.prisma.draftTransaction.findUnique({ where: { id: draftId }, include: { lines: true } });
    if (!d || d.ledgerId !== ledgerId) throw new NotFoundException('غير موجود');
    if (d.status !== 'DRAFT') throw new BadRequestException('لا يمكن تعديل هذه المسودة');
    this.assertCommercialLedger(d.kind, l.type);

    const data: Record<string, unknown> = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.businessDate !== undefined) {
      const raw = String(dto.businessDate).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new BadRequestException('التاريخ غير صالح');
      const when = new Date(`${raw}T00:00:00.000Z`);
      if (Number.isNaN(when.getTime())) throw new BadRequestException('التاريخ غير صالح');
      data.businessDate = when;
    }
    if (dto.contactId !== undefined) {
      const contact = await this.resolveContact(ledgerId, d.kind, dto.contactId);
      data.contactId = contact?.id ?? null;
    }
    if (dto.productId !== undefined || dto.quantity !== undefined) {
      if (dto.productId !== undefined && (dto.productId === null || String(dto.productId).trim() === '')) {
        data.productId = null;
        data.quantity = null;
      } else {
        const rawProductId = dto.productId !== undefined ? dto.productId : d.productId;
        const rawQuantity =
          dto.quantity !== undefined ? dto.quantity : d.quantity ? d.quantity.toFixed(6) : undefined;
        const stock = await this.resolveDraftStock(l, ledgerId, d.kind, rawProductId, rawQuantity);
        data.productId = stock.productId;
        data.quantity = stock.quantity;
      }
    }
    if (Object.keys(data).length > 0) {
      await this.prisma.draftTransaction.update({ where: { id: draftId }, data });
    }

    const ldata: Record<string, unknown> = {};
    if (dto.amount !== undefined) {
      const amt = positiveDecimal(dto.amount, 'المبلغ');
      ldata.amount = amt;
      ldata.baseAmount = dto.amountBase ? positiveDecimal(dto.amountBase, 'المبلغ الأساسي') : amt;
    }
    if (dto.financialAccountId) {
      const acc = await this.prisma.financialAccount.findUnique({ where: { id: dto.financialAccountId } });
      if (!acc || acc.ledgerId !== ledgerId || acc.archivedAt) throw new BadRequestException('الحساب غير صالح');
      ldata.accountId = acc.id;
    }
    if (dto.categoryId) {
      const cat = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!cat || cat.ledgerId !== ledgerId || cat.archivedAt) throw new BadRequestException('التصنيف غير صالح');
      ldata.categoryId = cat.id;
      ldata.categoryItemId = null;
    }
    if (dto.categoryItemId !== undefined) {
      const item = await this.prisma.categoryItem.findUnique({ where: { id: dto.categoryItemId }, include: { category: true } });
      const targetCategoryId = dto.categoryId ?? d.lines[0]?.categoryId;
      if (!item || item.categoryId !== targetCategoryId || item.archivedAt || item.category.ledgerId !== ledgerId) {
        throw new BadRequestException('البند الفرعي غير صالح');
      }
      ldata.categoryItemId = item.id;
    }
    if (dto.description !== undefined && d.lines[0]) ldata.memo = dto.description;
    if (d.lines[0] && Object.keys(ldata).length > 0) {
      await this.prisma.draftLine.update({ where: { id: d.lines[0].id }, data: ldata });
    }

    const d2 = await this.prisma.draftTransaction.findUnique({ where: { id: draftId }, include: { lines: true } });
    const line = d2?.lines[0];
    const [acc, cat, item, curr, contact] = await Promise.all([
      line && line.accountId ? this.prisma.financialAccount.findUnique({ where: { id: line.accountId } }) : null,
      line && line.categoryId ? this.prisma.category.findUnique({ where: { id: line.categoryId } }) : null,
      line && line.categoryItemId ? this.prisma.categoryItem.findUnique({ where: { id: line.categoryItemId } }) : null,
      d2 ? this.prisma.currency.findUnique({ where: { id: d2.originalCurrencyId } }) : null,
      d2 && d2.contactId ? this.prisma.contact.findUnique({ where: { id: d2.contactId } }) : null,
    ]);

    return {
      message: 'تم تحديث المسودة',
      review:
        d2 && {
          message: 'يرجى مراجعة بيانات العملية قبل التأكيد',
          typeAr: kindLabel(d2.kind),
          amount: d2.originalAmount,
          currency: curr?.code ?? undefined,
          account: acc?.name ?? undefined,
          category: cat?.name ?? undefined,
          categoryItem: item?.name,
          contact: contact ? { id: contact.id, name: contact.name, kind: contact.kind } : undefined,
          description: d2.description ?? undefined,
          businessDate: d2.businessDate,
        },
    };
  }

  async confirmDraft(ledgerId: string, draftId: string, actorId: string) {
    if (!this.isUuid(ledgerId) || !this.isUuid(draftId)) throw new NotFoundException('غير موجود');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('الدفتر غير موجود');
    if (!(await this.hasPerm(actorId, l, Permission.ENTRY_CONFIRM))) throw new ForbiddenException('لا تملك صلاحية تنفيذ هذه العملية');

    const d = await this.prisma.draftTransaction.findUnique({ where: { id: draftId }, include: { lines: true } });
    if (!d || d.ledgerId !== ledgerId) throw new NotFoundException('غير موجود');
    if (d.status !== 'DRAFT' && d.status !== 'SUBMITTED') throw new BadRequestException('لا يمكن تأكيد المسودة');
    if (d.lines.length === 0) throw new BadRequestException('مسودة غير مكتملة');
    this.assertCommercialLedger(d.kind, l.type);

    const source = d.lines[0];
    const sourceAcc = await this.prisma.financialAccount.findUnique({ where: { id: source.accountId ?? '' } });
    if (!sourceAcc || sourceAcc.ledgerId !== ledgerId || sourceAcc.archivedAt) throw new BadRequestException('الحساب غير صالح');

    if (isTransferKind(d.kind)) {
      const cptyId = d.counterpartyAccountId;
      if (!cptyId || cptyId === sourceAcc.id) throw new BadRequestException('حساب الوجهة غير صالح');
      const cpty = await this.prisma.financialAccount.findUnique({ where: { id: cptyId } });
      if (!cpty || cpty.ledgerId !== ledgerId || cpty.archivedAt) throw new BadRequestException('حساب الوجهة غير صالح');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.draftTransaction.update({ where: { id: draftId }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
      await tx.transactionAuditLog.create({
        data: { ledgerId, draftId, action: 'CONFIRM', actorId, createdAt: new Date() },
      });
    });

    const d2 = await this.prisma.draftTransaction.findUnique({ where: { id: draftId }, include: { lines: true } });
    const line = d2?.lines[0];
    const [acc, cat, item, curr, contact] = await Promise.all([
      line && line.accountId ? this.prisma.financialAccount.findUnique({ where: { id: line.accountId } }) : null,
      line && line.categoryId ? this.prisma.category.findUnique({ where: { id: line.categoryId } }) : null,
      line && line.categoryItemId ? this.prisma.categoryItem.findUnique({ where: { id: line.categoryItemId } }) : null,
      d2 ? this.prisma.currency.findUnique({ where: { id: d2.originalCurrencyId } }) : null,
      d2 && d2.contactId ? this.prisma.contact.findUnique({ where: { id: d2.contactId } }) : null,
    ]);

    return {
      message: 'تم تأكيد العملية وهي جاهزة للاعتماد',
      review:
        d2 && {
          message: 'تم تأكيد المسودة',
          typeAr: kindLabel(d2.kind),
          amount: d2.originalAmount,
          currency: curr?.code ?? undefined,
          account: acc?.name ?? undefined,
          category: cat?.name ?? undefined,
          categoryItem: item?.name,
          contact: contact ? { id: contact.id, name: contact.name, kind: contact.kind } : undefined,
          description: d2.description ?? undefined,
          businessDate: d2.businessDate,
        },
    };
  }

  async postDraft(ledgerId: string, draftId: string, actorId: string, dueDate?: string) {
    if (!this.isUuid(ledgerId) || !this.isUuid(draftId)) throw new NotFoundException('غير موجود');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('الدفتر غير موجود');
    if (!(await this.hasPerm(actorId, l, Permission.ENTRY_POST))) throw new ForbiddenException('لا تملك صلاحية تنفيذ هذه العملية');

    const d = await this.prisma.draftTransaction.findUnique({ where: { id: draftId }, include: { lines: true } });
    if (!d || d.ledgerId !== ledgerId) throw new NotFoundException('غير موجود');
    if (d.status !== 'CONFIRMED') throw new BadRequestException('يجب تأكيد المسودة قبل الاعتماد');
    if (d.lines.length === 0) throw new BadRequestException('مسودة غير مكتملة');
    if (d.postedEntryId) throw new BadRequestException('تم اعتماد هذه المسودة مسبقًا');
    this.assertCommercialLedger(d.kind, l.type);

    const line = d.lines[0];
    const acc = await this.prisma.financialAccount.findUnique({ where: { id: line.accountId ?? '' } });
    if (!acc || acc.ledgerId !== ledgerId || acc.archivedAt) throw new BadRequestException('الحساب غير صالح');

    if (isTransferKind(d.kind)) {
      const cptyId = d.counterpartyAccountId;
      if (!cptyId || cptyId === acc.id) throw new BadRequestException('حساب الوجهة غير صالح');
      const cpty = await this.prisma.financialAccount.findUnique({ where: { id: cptyId } });
      if (!cpty || cpty.ledgerId !== ledgerId || cpty.archivedAt) throw new BadRequestException('حساب الوجهة غير صالح');
    }

    const debtDirection = debtDirectionForKind(d.kind);
    const debtDueDate = optionalDate(dueDate);
    if (isDebtOpeningKind(d.kind) && !d.contactId) {
      const required = requiredContactKind(d.kind) === 'CUSTOMER' ? 'عميلًا' : 'موردًا';
      throw new BadRequestException(
        `${TRANSACTION_ERROR_CODES.CONTACT_REQUIRED}: ${kindLabel(d.kind)} يتطلب ${required}`,
      );
    }

    let product: Product | null = null;
    if (d.productId) {
      if (!l.stockEnabled) {
        throw new ForbiddenException(
          `${INVENTORY_ERROR_CODES.FEATURE_DISABLED}: المخزون غير مفعّل في هذا الدفتر`,
        );
      }
      product = await this.prisma.product.findUnique({ where: { id: d.productId } });
      if (!product || product.ledgerId !== ledgerId) {
        throw new BadRequestException(`${INVENTORY_ERROR_CODES.PRODUCT_NOT_FOUND}: المنتج غير موجود`);
      }
      if (product.archivedAt) {
        throw new BadRequestException(
          `${INVENTORY_ERROR_CODES.PRODUCT_ARCHIVED}: لا يمكن استخدام منتج مؤرشف`,
        );
      }
    }

    const entryId = await this.prisma.$transaction(async (tx) => {
      const seq = (await tx.journalEntry.count({ where: { ledgerId } })) + 1;
      const entry = await tx.journalEntry.create({
        data: {
          ledgerId,
          sequenceNumber: seq,
          status: 'POSTED',
          kind: d.kind,
          description: d.description,
          occurredAt: d.occurredAt,
          businessDate: d.businessDate,
          originalCurrencyId: d.originalCurrencyId,
          originalAmount: d.originalAmount,
          baseAmount: d.baseAmount,
          baseCurrencyId: l.baseCurrencyId,
          contactId: d.contactId,
          postedById: actorId,
          postedAt: new Date(),
        },
      });

      await tx.journalLine.create({
        data: {
          ledgerId,
          entryId: entry.id,
          direction: isTransferKind(d.kind) ? 'CREDIT' : entryDirection(d.kind),
          accountId: acc.id,
          categoryId: line.categoryId,
          categoryItemId: line.categoryItemId,
          amount: line.amount,
          currencyId: d.originalCurrencyId,
          baseAmount: line.baseAmount,
          baseCurrencyId: l.baseCurrencyId,
          exchangeRate: 1,
          memo: line.memo,
        },
      });

      if (isTransferKind(d.kind)) {
        const cptyId = d.counterpartyAccountId;
        await tx.journalLine.create({
          data: {
            ledgerId,
            entryId: entry.id,
            direction: 'DEBIT',
            accountId: cptyId!,
            categoryId: line.categoryId,
            categoryItemId: line.categoryItemId,
            amount: line.amount,
            currencyId: d.originalCurrencyId,
            baseAmount: line.baseAmount,
            baseCurrencyId: l.baseCurrencyId,
            exchangeRate: 1,
            memo: line.memo,
          },
        });
      } else {
      if (isDebtOpeningKind(d.kind) && debtDirection && d.contactId) {
        await tx.debt.create({
          data: {
            ledgerId,
            contactId: d.contactId,
            direction: debtDirection,
            status: 'OPEN',
            sourceEntryId: entry.id,
            description: d.description,
            businessDate: d.businessDate,
            originalAmount: d.originalAmount,
            settledAmount: new Prisma.Decimal(0),
            currencyId: d.originalCurrencyId,
            baseAmount: d.baseAmount,
            baseSettledAmount: new Prisma.Decimal(0),
            baseCurrencyId: l.baseCurrencyId,
            exchangeRate: d.exchangeRate,
            dueDate: debtDueDate,
          },
        });
      }

      if (product && d.quantity) {
        await this.stock.applyTransactionStock(tx, {
          ledgerId,
          entryId: entry.id,
          kind: d.kind,
          product,
          quantity: d.quantity,
          baseAmount: d.baseAmount,
          businessDate: d.businessDate,
        });
      }
    }

    await tx.draftTransaction.update({
      where: { id: draftId },
      data: { status: 'POSTED', postedEntryId: entry.id },
    });

    await tx.transactionAuditLog.create({
      data: { ledgerId, draftId, action: 'POST', actorId, entryId: entry.id, createdAt: new Date() },
    });

    return entry.id;
  });

  return { message: 'تم اعتماد العملية بنجاح', entryId };
}

  async listEntries(ledgerId: string, actorId: string) {
    if (!this.isUuid(ledgerId)) throw new NotFoundException('الدفتر غير موجود');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('الدفتر غير موجود');
    if (!(await this.hasPerm(actorId, l, Permission.ENTRY_VIEW))) throw new ForbiddenException('لا تملك صلاحية تنفيذ هذه العملية');
    return this.prisma.journalEntry.findMany({
      where: { ledgerId },
      include: {
        originalCurrency: { select: { code: true } },
        lines: {
          include: {
            account: { select: { name: true } },
            category: { select: { name: true } },
            categoryItem: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}