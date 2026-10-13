import { BadRequestException, Injectable } from '@nestjs/common';
import { Permission, Prisma, type Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { INVENTORY_ERROR_CODES } from './inventory.errors.js';
import { gateInventory, isUuid } from './inventory.gate.js';
import { isInboundMovement, isManualMovementType, isPurchaseKind, type ManualMovementType } from './inventory.constants.js';
import { money, parseDecimal, quantityText, round4 } from './inventory.decimals.js';
import { StockQueryDto } from './dto/stock-query.dto.js';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';

export type PostingStockParams = {
  ledgerId: string;
  entryId: string;
  kind: string;
  product: Product;
  quantity: Prisma.Decimal;
  baseAmount: Prisma.Decimal;
  businessDate: Date;
};

export type PostingStockResult = {
  type: 'PURCHASE' | 'SALE';
  unitCost: Prisma.Decimal;
  cogs: Prisma.Decimal;
  balance: Prisma.Decimal;
};

function dayStart(raw: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new BadRequestException(`${field} غير صالح`);
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} غير صالح`);
  return date;
}

function todayStart(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadProduct(ledgerId: string, productId: string): Promise<Product> {
    if (!isUuid(productId)) throw new BadRequestException('معرّف المنتج غير صالح');
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.ledgerId !== ledgerId) {
      throw new BadRequestException(`${INVENTORY_ERROR_CODES.PRODUCT_NOT_FOUND}: المنتج غير موجود`);
    }
    return product;
  }

  private async loadWarehouse(ledgerId: string, warehouseId: string): Promise<{ id: string }> {
    if (!isUuid(warehouseId)) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.WAREHOUSE_NOT_FOUND}: المستودع غير موجود`,
      );
    }
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || warehouse.ledgerId !== ledgerId) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.WAREHOUSE_NOT_FOUND}: المستودع غير موجود`,
      );
    }
    if (warehouse.archivedAt) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.WAREHOUSE_ARCHIVED}: لا يمكن استخدام مستودع مؤرشف`,
      );
    }
    return warehouse;
  }

  private serializeMovement(movement: {
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
  }) {
    return {
      id: movement.id,
      ledgerId: movement.ledgerId,
      productId: movement.productId,
      warehouseId: movement.warehouseId,
      type: movement.type,
      quantity: quantityText(movement.quantity),
      unitCost: movement.unitCost === null ? null : money(movement.unitCost),
      entryId: movement.entryId,
      businessDate: movement.businessDate.toISOString().slice(0, 10),
      note: movement.note,
      createdAt: movement.createdAt.toISOString(),
    };
  }

  async getStock(ledgerId: string, actorId: string, productId: string) {
    await gateInventory(this.prisma, ledgerId, actorId, Permission.LEDGER_VIEW);
    const product = await this.loadProduct(ledgerId, productId);
    const movements = await this.prisma.stockMovement.findMany({
      where: { ledgerId, productId },
      select: { quantity: true, unitCost: true, warehouseId: true },
    });

    let totalQuantity = ZERO;
    let totalValue = ZERO;
    const warehouses = new Map<string, { quantity: Prisma.Decimal; value: Prisma.Decimal }>();
    for (const movement of movements) {
      const value = movement.quantity.mul(movement.unitCost ?? ZERO);
      totalQuantity = totalQuantity.add(movement.quantity);
      totalValue = totalValue.add(value);
      const bucket = warehouses.get(movement.warehouseId) ?? { quantity: ZERO, value: ZERO };
      bucket.quantity = bucket.quantity.add(movement.quantity);
      bucket.value = bucket.value.add(value);
      warehouses.set(movement.warehouseId, bucket);
    }
    const wac = totalQuantity.gt(0) ? round4(totalValue.div(totalQuantity)) : ZERO;

    return {
      productId: product.id,
      kind: product.kind,
      trackStock: product.trackStock,
      quantity: quantityText(totalQuantity),
      value: money(totalValue),
      wac: money(wac),
      warehouses: Array.from(warehouses.entries()).map(([warehouseId, bucket]) => ({
        warehouseId,
        quantity: quantityText(bucket.quantity),
        value: money(bucket.value),
      })),
    };
  }

  async listMovements(
    ledgerId: string,
    actorId: string,
    productId: string,
    query: StockQueryDto = {},
  ) {
    await gateInventory(this.prisma, ledgerId, actorId, Permission.LEDGER_VIEW);
    await this.loadProduct(ledgerId, productId);

    const from = query.from ? dayStart(query.from, 'from') : undefined;
    const to = query.to ? dayStart(query.to, 'to') : undefined;
    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException('المدى الزمني غير صالح');
    }
    const businessDate =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    const movements = await this.prisma.stockMovement.findMany({
      where: { ledgerId, productId, ...(businessDate ? { businessDate } : {}) },
      orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
    });

    return movements.map((movement) => this.serializeMovement(movement));
  }

  /**
   * حركة مخزون يدوية (`RETURN_IN`/`RETURN_OUT`/`ADJUSTMENT_IN`/`ADJUSTMENT_OUT`).
   * تُنفَّذ داخل معاملة واحدة: تُقرأ الحركات السابقة، ويُحسب المتوسط المرجّح،
   * ويُمنع الرصيد السالب على مستوى المستودع، ويُحفظ `unitCost` كي لا يتغيّر WAC
   * بالوارد. لا تُنشئ قيدًا محاسبيًا (مؤجّل)، والسبب يُخزَّن في `note`.
   */
  async createManualMovement(ledgerId: string, actorId: string, dto: CreateStockMovementDto) {
    await gateInventory(this.prisma, ledgerId, actorId, Permission.ENTRY_CREATE);
    if (!isManualMovementType(dto.type)) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.MOVEMENT_TYPE_INVALID}: النوع يجب أن يكون RETURN_IN أو RETURN_OUT أو ADJUSTMENT_IN أو ADJUSTMENT_OUT`,
      );
    }
    const quantity = parseDecimal(dto.quantity, 'الكمية');
    if (!quantity.gt(0)) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.INVALID_QUANTITY}: الكمية يجب أن تكون أكبر من صفر`,
      );
    }
    const businessDate = dto.businessDate ? dayStart(dto.businessDate, 'businessDate') : todayStart();

    const product = await this.loadProduct(ledgerId, dto.productId);
    if (product.archivedAt) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.PRODUCT_ARCHIVED}: لا يمكن استخدام منتج مؤرشف`,
      );
    }
    if (product.kind !== 'GOOD' || !product.trackStock) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.PRODUCT_NOT_STOCKED}: المنتج لا يخضع للمخزون`,
      );
    }
    const warehouse = await this.loadWarehouse(ledgerId, dto.warehouseId);

    // يُلتقط النوع المُضيَّق في ثابت لأن تضييق خاصية داخل إغلاق المعاملة لا يُحفظ.
    const type: ManualMovementType = dto.type;
    const inbound = isInboundMovement(type);
    const reason = (dto.reason ?? '').trim();
    const note = reason.length > 0 ? reason : inbound ? 'وارد يدوي' : 'صادر يدوي';

    const created = await this.prisma.$transaction(async (tx) => {
      const movements = await tx.stockMovement.findMany({
        where: { ledgerId, productId: product.id },
        select: { quantity: true, unitCost: true, warehouseId: true },
      });
      let balance = ZERO;
      let value = ZERO;
      let warehouseBalance = ZERO;
      for (const movement of movements) {
        balance = balance.add(movement.quantity);
        value = value.add(movement.quantity.mul(movement.unitCost ?? ZERO));
        if (movement.warehouseId === warehouse.id) {
          warehouseBalance = warehouseBalance.add(movement.quantity);
        }
      }

      let unitCost: Prisma.Decimal;
      if (inbound) {
        // وارد بالمتوسط المرجّح الحالي كي لا يتغيّر WAC، وبـ`costPrice` عند غياب رصيد.
        unitCost = balance.gt(0) ? round4(value.div(balance)) : round4(product.costPrice ?? ZERO);
      } else {
        if (warehouseBalance.lt(quantity)) {
          throw new BadRequestException(
            `${INVENTORY_ERROR_CODES.INSUFFICIENT_STOCK}: المخزون غير كافٍ في هذا المستودع`,
          );
        }
        unitCost = balance.gt(0) ? round4(value.div(balance)) : ZERO;
      }

      const row = await tx.stockMovement.create({
        data: {
          ledgerId,
          productId: product.id,
          warehouseId: warehouse.id,
          type: type,
          quantity: inbound ? quantity : quantity.neg(),
          unitCost,
          entryId: null,
          businessDate,
          note,
        },
      });
      return this.serializeMovement(row);
    });

    return { message: 'تم تسجيل حركة المخزون', movement: created };
  }

  private async resolveWarehouse(
    tx: Prisma.TransactionClient,
    ledgerId: string,
    preferredId: string | null,
  ) {
    if (preferredId) {
      const warehouse = await tx.warehouse.findUnique({ where: { id: preferredId } });
      if (!warehouse || warehouse.ledgerId !== ledgerId || warehouse.archivedAt) {
        throw new BadRequestException(
          `${INVENTORY_ERROR_CODES.WAREHOUSE_NOT_FOUND}: المستودع غير موجود`,
        );
      }
      return warehouse;
    }
    const fallback = await tx.warehouse.findFirst({
      where: { ledgerId, isDefault: true, archivedAt: null },
    });
    if (!fallback) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.WAREHOUSE_REQUIRED}: لا يوجد مستودع افتراضي لترحيل الحركة`,
      );
    }
    return fallback;
  }

  /**
   * يُنفَّذ داخل `$transaction` الاعتماد نفسها: PURCHASE يُضيف حركة موجبة ويكتب
   * الإنفاق في تكلفة الوحدة؛ SALE يتحقق من الرصيد ثم يُخرج حركة سالبة ويكتب COGS
   * بتكلفة المتوسط المرجّح قبل الخصم. يعيد `null` للخدمات أو المنتجات غير المخزَّنة.
   */
  async applyTransactionStock(
    tx: Prisma.TransactionClient,
    params: PostingStockParams,
  ): Promise<PostingStockResult | null> {
    const { product } = params;
    if (product.kind !== 'GOOD' || !product.trackStock) return null;
    if (product.archivedAt) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.PRODUCT_ARCHIVED}: لا يمكن استخدام منتج مؤرشف`,
      );
    }
    if (!params.quantity.gt(0)) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.INVALID_QUANTITY}: الكمية يجب أن تكون أكبر من صفر`,
      );
    }

    const warehouse = await this.resolveWarehouse(tx, params.ledgerId, product.defaultWarehouseId);
    const movements = await tx.stockMovement.findMany({
      where: { ledgerId: params.ledgerId, productId: product.id },
      select: { quantity: true, unitCost: true },
    });
    let balance = ZERO;
    let value = ZERO;
    for (const movement of movements) {
      balance = balance.add(movement.quantity);
      value = value.add(movement.quantity.mul(movement.unitCost ?? ZERO));
    }

    if (isPurchaseKind(params.kind)) {
      const unitCost = round4(params.baseAmount.div(params.quantity));
      await tx.stockMovement.create({
        data: {
          ledgerId: params.ledgerId,
          productId: product.id,
          warehouseId: warehouse.id,
          type: 'PURCHASE',
          quantity: params.quantity,
          unitCost,
          entryId: params.entryId,
          businessDate: params.businessDate,
          note: 'شراء',
        },
      });
      return {
        type: 'PURCHASE',
        unitCost,
        cogs: ZERO,
        balance: balance.add(params.quantity),
      };
    }

    if (balance.lt(params.quantity)) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.INSUFFICIENT_STOCK}: المخزون غير كافٍ لتنفيذ البيع`,
      );
    }
    const wac = round4(value.div(balance));
    const cogs = round4(params.quantity.mul(wac));
    await tx.stockMovement.create({
      data: {
        ledgerId: params.ledgerId,
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'SALE',
        quantity: params.quantity.neg(),
        unitCost: wac,
        entryId: params.entryId,
        businessDate: params.businessDate,
        note: 'بيع',
      },
    });
    return {
      type: 'SALE',
      unitCost: wac,
      cogs,
      balance: balance.sub(params.quantity),
    };
  }
}
