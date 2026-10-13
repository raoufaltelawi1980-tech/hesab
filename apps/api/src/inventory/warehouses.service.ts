import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Permission, Prisma, type Warehouse } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { INVENTORY_ERROR_CODES } from './inventory.errors.js';
import { gateInventory, isUuid, type InventoryLedger } from './inventory.gate.js';
import { CreateWarehouseDto } from './dto/create-warehouse.dto.js';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto.js';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(warehouse: Warehouse) {
    return {
      id: warehouse.id,
      ledgerId: warehouse.ledgerId,
      name: warehouse.name,
      isDefault: warehouse.isDefault,
      currencyId: warehouse.currencyId,
      archivedAt: warehouse.archivedAt ? warehouse.archivedAt.toISOString() : null,
      createdAt: warehouse.createdAt.toISOString(),
      updatedAt: warehouse.updatedAt.toISOString(),
    };
  }

  private requireName(raw: unknown, max: number): string {
    if (typeof raw !== 'string') throw new BadRequestException('name مطلوب');
    const name = raw.trim();
    if (name.length < 1) throw new BadRequestException('name مطلوب');
    if (name.length > max) throw new BadRequestException(`name يجب أن لا يتجاوز ${max} حرفًا`);
    return name;
  }

  private async resolveCurrency(ledger: InventoryLedger, raw: unknown): Promise<string> {
    if (raw === undefined || raw === null || raw === '') return ledger.baseCurrencyId;
    if (!isUuid(raw)) throw new BadRequestException('معرّف العملة غير صالح');
    const currency = await this.prisma.currency.findUnique({ where: { id: raw } });
    if (!currency) throw new BadRequestException('العملة غير صالحة');
    return currency.id;
  }

  private async load(ledgerId: string, warehouseId: string): Promise<Warehouse> {
    if (!isUuid(warehouseId)) throw new BadRequestException('معرّف المستودع غير صالح');
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || warehouse.ledgerId !== ledgerId) {
      throw new NotFoundException(
        `${INVENTORY_ERROR_CODES.WAREHOUSE_NOT_FOUND}: المستودع غير موجود`,
      );
    }
    return warehouse;
  }

  async create(ledgerId: string, actorId: string, dto: CreateWarehouseDto) {
    const ledger = await gateInventory(this.prisma, ledgerId, actorId, Permission.LEDGER_MANAGE);
    const name = this.requireName(dto.name, 160);
    const currencyId = await this.resolveCurrency(ledger, dto.currencyId);
    const activeCount = await this.prisma.warehouse.count({ where: { ledgerId, archivedAt: null } });
    const makeDefault = dto.isDefault === true || activeCount === 0;

    const created = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.warehouse.updateMany({
          where: { ledgerId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.warehouse.create({ data: { ledgerId, name, currencyId, isDefault: makeDefault } });
    });
    return this.serialize(created);
  }

  async list(ledgerId: string, actorId: string) {
    await gateInventory(this.prisma, ledgerId, actorId, Permission.LEDGER_VIEW);
    const warehouses = await this.prisma.warehouse.findMany({
      where: { ledgerId, archivedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return warehouses.map((warehouse) => this.serialize(warehouse));
  }

  async get(ledgerId: string, warehouseId: string, actorId: string) {
    await gateInventory(this.prisma, ledgerId, actorId, Permission.LEDGER_VIEW);
    return this.serialize(await this.load(ledgerId, warehouseId));
  }

  async update(ledgerId: string, warehouseId: string, actorId: string, dto: UpdateWarehouseDto) {
    const ledger = await gateInventory(this.prisma, ledgerId, actorId, Permission.LEDGER_MANAGE);
    const warehouse = await this.load(ledgerId, warehouseId);
    if (warehouse.archivedAt) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.WAREHOUSE_ARCHIVED}: لا يمكن تعديل مستودع مؤرشف`,
      );
    }
    if (dto.isDefault === false && warehouse.isDefault) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.WAREHOUSE_DEFAULT}: عيّن مستودعًا آخر افتراضيًا بدلًا من إلغاء الافتراضي`,
      );
    }

    const data: Prisma.WarehouseUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = this.requireName(dto.name, 160);
    if (dto.currencyId !== undefined) data.currencyId = await this.resolveCurrency(ledger, dto.currencyId);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.warehouse.updateMany({
          where: { ledgerId, isDefault: true, id: { not: warehouseId } },
          data: { isDefault: false },
        });
      }
      if (dto.isDefault !== undefined) data.isDefault = dto.isDefault === true;
      return tx.warehouse.update({ where: { id: warehouseId }, data });
    });
    return this.serialize(updated);
  }

  async archive(ledgerId: string, warehouseId: string, actorId: string) {
    await gateInventory(this.prisma, ledgerId, actorId, Permission.LEDGER_MANAGE);
    const warehouse = await this.load(ledgerId, warehouseId);
    if (warehouse.archivedAt) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.WAREHOUSE_ARCHIVED}: المستودع مؤرشف مسبقًا`,
      );
    }
    if (warehouse.isDefault) {
      throw new BadRequestException(
        `${INVENTORY_ERROR_CODES.WAREHOUSE_DEFAULT}: لا يمكن أرشفة المستودع الافتراضي`,
      );
    }
    const updated = await this.prisma.warehouse.update({
      where: { id: warehouseId },
      data: { archivedAt: new Date() },
    });
    return { message: 'تم أرشفة المستودع', warehouse: this.serialize(updated) };
  }
}
