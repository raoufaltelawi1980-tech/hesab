import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Permission } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service.js';
import { INVENTORY_ERROR_CODES } from './inventory.errors.js';

export const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export type InventoryLedger = {
  id: string;
  ownerId: string;
  type: string;
  baseCurrencyId: string;
  stockEnabled: boolean;
};

/**
 * بوابة واحدة لكل مسارات المخزون: الدفتر موجود، والفاعل يملك الصلاحية، والدفتر
 * تجاري `BUSINESS`، والمخزون مفعّل `stockEnabled`. الصلاحية تُفحص قبل النوع
 * حتى لا يعرف الغريب شيئًا.
 */
export async function gateInventory(
  prisma: PrismaService,
  ledgerId: string,
  actorId: string,
  permission: Permission,
): Promise<InventoryLedger> {
  if (!isUuid(ledgerId)) throw new BadRequestException('معرّف الدفتر غير صالح');
  const ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } });
  if (!ledger) throw new BadRequestException('الدفتر غير موجود');
  if (!(await can(prisma, ledger, actorId, permission))) {
    throw new ForbiddenException('لا تملك صلاحية تنفيذ هذه العملية');
  }
  if (ledger.type !== 'BUSINESS') {
    throw new ForbiddenException(
      `${INVENTORY_ERROR_CODES.LEDGER_NOT_BUSINESS}: المخزون متاح للدفتر التجاري فقط`,
    );
  }
  if (!ledger.stockEnabled) {
    throw new ForbiddenException(
      `${INVENTORY_ERROR_CODES.FEATURE_DISABLED}: المخزون غير مفعّل في هذا الدفتر`,
    );
  }
  return ledger;
}

async function can(
  prisma: PrismaService,
  ledger: { id: string; ownerId: string },
  actorId: string,
  permission: Permission,
): Promise<boolean> {
  if (ledger.ownerId === actorId) return true;
  const membership = await prisma.ledgerMember.findUnique({
    where: { ledgerId_userId: { ledgerId: ledger.id, userId: actorId } },
    include: { permissions: true },
  });
  if (!membership) return false;
  return membership.permissions.some(
    (row: { revokedAt: Date | null; permission: Permission }) =>
      !row.revokedAt && row.permission === permission,
  );
}
