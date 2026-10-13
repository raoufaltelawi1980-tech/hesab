import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Permission, Prisma, type Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { INVENTORY_ERROR_CODES } from './inventory.errors.js';
import { gateInventory, isUuid, type InventoryLedger } from './inventory.gate.js';
import { money, nonNegativeDecimal } from './inventory.decimals.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsDto } from './dto/list-products.dto.js';

type ProductKind = 'GOOD' | 'SERVICE';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(product: Product) {
    return {
      id: product.id,
      ledgerId: product.ledgerId,
      kind: product.kind,
      sku: product.sku,
      name: product.name,
      description: product.description,
      unitPrice: money(product.unitPrice),
      costPrice: product.costPrice === null ? null : money(product.costPrice),
      currencyId: product.currencyId,
      trackStock: product.trackStock,
      defaultWarehouseId: product.defaultWarehouseId,
      archivedAt: product.archivedAt ? product.archivedAt.toISOString() : null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  private normalizeKind(raw: unknown): ProductKind {
    if (raw === 'GOOD' || raw === 'SERVICE') return raw;
    throw new BadRequestException(
      `${INVENTORY_ERROR_CODES.PRODUCT_KIND_INVALID}: kind يجب أن يكون GOOD أو SERVICE`,
    );
  }

  private optionalSku(raw: unknown): string | null {
    if (raw === undefined || raw === null) return null;
    if (typeof raw !== 'string') throw new BadRequestException('sku غير صالح');
    const text = raw.trim();
    if (text.length === 0) return null;
    if (text.length > 80) throw new BadRequestException('sku يجب أن لا يتجاوز 80 حرفًا');
    return text;
  }

  private optionalText(raw: unknown, max: number, field: string): string | null {
    if (raw === undefined || raw === null) return null;
    if (typeof raw !== 'string') throw new BadRequestException(`${field} غير صالح`);
    const text = raw.trim();
    if (text.length === 0) return null;
    if (text.length > max) throw new BadRequestException(`${field} يجب أن لا يتجاوز ${max} حرفًا`);
    return text;
  }

  private requireName(raw: unknown): string {
    if (typeof raw !== 'string') throw new BadRequestException('name مطلوب');
    const name = raw.trim();
    if (name.length < 1) throw new BadRequestException('name مطلوب');
    if (name.length > 200) throw new BadRequestException('name يجب أن لا يتجاوز 200 حرفًا');
    return name;
  }

  private assertStockConsistency(
    kind: ProductKind,
    trackStock: boolean,
    defaultWarehouseId: string | null,
  ): void {
    if (kind === 'SERVICE' && trackStock) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.PRODUCT_NOT_STOCKED}: الخدمة لا تدخل المخزون`,
      );
    }
    if (!trackStock && defaultWarehouseId) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.PRODUCT_NOT_STOCKED}: لا يُربط مستودع بمنتج غير مخزَّن`,
      );
    }
  }

  private async resolveCurrency(ledger: InventoryLedger, raw: unknown): Promise<string> {
    if (raw === undefined || raw === null || raw === '') return ledger.baseCurrencyId;
    if (!isUuid(raw)) throw new BadRequestException('معرّف العملة غير صالح');
    const currency = await this.prisma.currency.findUnique({ where: { id: raw } });
    if (!currency) throw new BadRequestException('العملة غير صالحة');
    return currency.id;
  }

  private async resolveWarehouse(ledgerId: string, raw: unknown): Promise<string> {
    if (!isUuid(raw)) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.WAREHOUSE_NOT_FOUND}: المستودع غير موجود`,
      );
    }
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: raw } });
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
    return warehouse.id;
  }

  private async assertSkuFree(ledgerId: string, sku: string | null, exceptId?: string): Promise<void> {
    if (!sku) return;
    const existing = await this.prisma.product.findFirst({ where: { ledgerId, sku } });
    if (existing && existing.id !== exceptId) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.SKU_DUPLICATE}: رمز المنتج مستخدم مسبقًا في هذا الدفتر`,
      );
    }
  }

  private async load(ledgerId: string, productId: string): Promise<Product> {
    if (!isUuid(productId)) throw new BadRequestException('معرّف المنتج غير صالح');
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.ledgerId !== ledgerId) {
      throw new NotFoundException(`${INVENTORY_ERROR_CODES.PRODUCT_NOT_FOUND}: المنتج غير موجود`);
    }
    return product;
  }

  async create(ledgerId: string, actorId: string, dto: CreateProductDto) {
    const ledger = await gateInventory(this.prisma, ledgerId, actorId, Permission.LEDGER_MANAGE);
    const kind = this.normalizeKind(dto.kind);
    const name = this.requireName(dto.name);
    const sku = this.optionalSku(dto.sku);
    await this.assertSkuFree(ledgerId, sku);
    const unitPrice = nonNegativeDecimal(dto.unitPrice, 'unitPrice');
    const costPrice =
      dto.costPrice === undefined || dto.costPrice === null
        ? null
        : nonNegativeDecimal(dto.costPrice, 'costPrice');
    const trackStock = dto.trackStock === true;
    const defaultWarehouseId = dto.defaultWarehouseId
      ? await this.resolveWarehouse(ledgerId, dto.defaultWarehouseId)
      : null;
    this.assertStockConsistency(kind, trackStock, defaultWarehouseId);
    const currencyId = await this.resolveCurrency(ledger, dto.currencyId);
    const description = this.optionalText(dto.description, 1000, 'description');

    const created = await this.prisma.product.create({
      data: {
        ledgerId,
        kind,
        sku,
        name,
        description,
        unitPrice,
        costPrice,
        currencyId,
        trackStock,
        defaultWarehouseId,
      },
    });
    return this.serialize(created);
  }

  async list(ledgerId: string, actorId: string, query: ListProductsDto = {}) {
    await gateInventory(this.prisma, ledgerId, actorId, Permission.LEDGER_VIEW);
    const kind =
      query.kind === undefined || query.kind === null || query.kind === ''
        ? undefined
        : this.normalizeKind(query.kind);
    const includeArchived =
      query.includeArchived === true ||
      query.includeArchived === 'true' ||
      query.includeArchived === '1';
    const products = await this.prisma.product.findMany({
      where: {
        ledgerId,
        ...(kind ? { kind } : {}),
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { name: 'asc' },
    });
    return products.map((product) => this.serialize(product));
  }

  async get(ledgerId: string, productId: string, actorId: string) {
    await gateInventory(this.prisma, ledgerId, actorId, Permission.LEDGER_VIEW);
    return this.serialize(await this.load(ledgerId, productId));
  }

  async update(ledgerId: string, productId: string, actorId: string, dto: UpdateProductDto) {
    const ledger = await gateInventory(this.prisma, ledgerId, actorId, Permission.LEDGER_MANAGE);
    const product = await this.load(ledgerId, productId);
    if (product.archivedAt) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.PRODUCT_ARCHIVED}: لا يمكن تعديل منتج مؤرشف`,
      );
    }

    const data: Prisma.ProductUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = this.requireName(dto.name);
    if (dto.sku !== undefined) {
      const sku = this.optionalSku(dto.sku);
      await this.assertSkuFree(ledgerId, sku, productId);
      data.sku = sku;
    }
    if (dto.description !== undefined) data.description = this.optionalText(dto.description, 1000, 'description');
    if (dto.unitPrice !== undefined) data.unitPrice = nonNegativeDecimal(dto.unitPrice, 'unitPrice');
    if (dto.costPrice !== undefined) {
      data.costPrice = dto.costPrice === null ? null : nonNegativeDecimal(dto.costPrice, 'costPrice');
    }
    if (dto.currencyId !== undefined) data.currencyId = await this.resolveCurrency(ledger, dto.currencyId);
    if (dto.trackStock !== undefined) data.trackStock = dto.trackStock === true;
    if (dto.defaultWarehouseId !== undefined) {
      data.defaultWarehouseId =
        dto.defaultWarehouseId === null || dto.defaultWarehouseId === ''
          ? null
          : await this.resolveWarehouse(ledgerId, dto.defaultWarehouseId);
    }

    const kind = this.normalizeKind(product.kind);
    const trackStock = (data.trackStock as boolean | undefined) ?? product.trackStock;
    const defaultWarehouseId =
      data.defaultWarehouseId !== undefined
        ? (data.defaultWarehouseId as string | null)
        : product.defaultWarehouseId;
    this.assertStockConsistency(kind, trackStock, defaultWarehouseId);

    const updated = await this.prisma.product.update({ where: { id: productId }, data });
    return this.serialize(updated);
  }

  async archive(ledgerId: string, productId: string, actorId: string) {
    await gateInventory(this.prisma, ledgerId, actorId, Permission.LEDGER_MANAGE);
    const product = await this.load(ledgerId, productId);
    if (product.archivedAt) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.PRODUCT_ARCHIVED}: المنتج مؤرشف مسبقًا`,
      );
    }
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { archivedAt: new Date() },
    });
    return { message: 'تم أرشفة المنتج', product: this.serialize(updated) };
  }
}
