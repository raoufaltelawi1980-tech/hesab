import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private isUuid(v: string): boolean {
    try { return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v); } catch { return false; }
  }

  async list(ledgerId: string, ownerId: string) {
    if (!this.isUuid(ledgerId)) throw new NotFoundException('Ledger not found');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('Ledger not found');
    if (l.ownerId !== ownerId) throw new ForbiddenException();
    return this.prisma.category.findMany({ where: { ledgerId }, include: { items: true }, orderBy: { createdAt: 'asc' } });
  }

  async createCategory(ledgerId: string, ownerId: string, dto: any) {
    if (!this.isUuid(ledgerId)) throw new NotFoundException('Ledger not found');
    if (!dto?.name || dto.name.trim() === '') throw new BadRequestException('Invalid name');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('Ledger not found');
    if (l.ownerId !== ownerId) throw new ForbiddenException();
    return this.prisma.category.create({ data: { ledgerId, kind: 'MAIN' as any, name: dto.name.trim(), colorHex: dto.colorHex, iconKey: dto.iconKey, systemKey: dto.systemKey } });
  }

  async patchCategory(ledgerId: string, categoryId: string, ownerId: string, dto: any) {
    if (!this.isUuid(ledgerId) || !this.isUuid(categoryId)) throw new NotFoundException('Not found');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('Ledger not found');
    if (l.ownerId !== ownerId) throw new ForbiddenException();
    const c = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!c || c.ledgerId !== ledgerId) throw new NotFoundException('Not found');
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.colorHex !== undefined) data.colorHex = dto.colorHex;
    if (dto.iconKey !== undefined) data.iconKey = dto.iconKey;
    return this.prisma.category.update({ where: { id: categoryId }, data });
  }

  async archiveCategory(ledgerId: string, categoryId: string, ownerId: string) {
    if (!this.isUuid(ledgerId) || !this.isUuid(categoryId)) throw new NotFoundException('Not found');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('Ledger not found');
    if (l.ownerId !== ownerId) throw new ForbiddenException();
    const c = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!c || c.ledgerId !== ledgerId) throw new NotFoundException('Not found');
    return this.prisma.category.update({ where: { id: categoryId }, data: { archivedAt: new Date() } });
  }

  async createItem(ledgerId: string, categoryId: string, ownerId: string, dto: any) {
    if (!this.isUuid(ledgerId) || !this.isUuid(categoryId)) throw new NotFoundException('Not found');
    if (!dto?.name || dto.name.trim() === '') throw new BadRequestException('Invalid name');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('Ledger not found');
    if (l.ownerId !== ownerId) throw new ForbiddenException();
    const c = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!c || c.ledgerId !== ledgerId || c.kind !== 'MAIN') throw new NotFoundException('Not found');
    return this.prisma.categoryItem.create({ data: { categoryId, name: dto.name.trim(), systemKey: dto.systemKey } });
  }

  async patchItem(ledgerId: string, categoryId: string, itemId: string, ownerId: string, dto: any) {
    if (!this.isUuid(ledgerId) || !this.isUuid(categoryId) || !this.isUuid(itemId)) throw new NotFoundException('Not found');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('Ledger not found');
    if (l.ownerId !== ownerId) throw new ForbiddenException();
    const it = await this.prisma.categoryItem.findUnique({ where: { id: itemId }, include: { category: true } });
    if (!it || it.categoryId !== categoryId || it.category.ledgerId !== ledgerId) throw new NotFoundException('Not found');
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    return this.prisma.categoryItem.update({ where: { id: itemId }, data });
  }

  async archiveItem(ledgerId: string, categoryId: string, itemId: string, ownerId: string) {
    if (!this.isUuid(ledgerId) || !this.isUuid(categoryId) || !this.isUuid(itemId)) throw new NotFoundException('Not found');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('Ledger not found');
    if (l.ownerId !== ownerId) throw new ForbiddenException();
    const it = await this.prisma.categoryItem.findUnique({ where: { id: itemId }, include: { category: true } });
    if (!it || it.categoryId !== categoryId || it.category.ledgerId !== ledgerId) throw new NotFoundException('Not found');
    return this.prisma.categoryItem.update({ where: { id: itemId }, data: { archivedAt: new Date() } });
  }
}
