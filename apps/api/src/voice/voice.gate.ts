import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Permission } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service.js';

export const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export type VoiceLedger = {
  id: string;
  ownerId: string;
  type: string;
  baseCurrencyId: string;
  stockEnabled: boolean;
};

/**
 * بوابة مسارات الصوت: الدفتر موجود والفاعل يملك الصلاحية. لا تُقيَّد بالدفتر
 * التجاري — الصوت متاح للعائلي والتجاري معًا، والقيد التجاري يُفرض لاحقًا عند
 * إنشاء المسودة نفسها. الصلاحية تُفحص قبل أي تفصيل آخر.
 */
export async function gateVoice(
  prisma: PrismaService,
  ledgerId: string,
  actorId: string,
  permission: Permission,
): Promise<VoiceLedger> {
  if (!isUuid(ledgerId)) throw new BadRequestException('معرّف الدفتر غير صالح');
  const ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } });
  if (!ledger) throw new BadRequestException('الدفتر غير موجود');
  if (!(await hasPermission(prisma, ledger, actorId, permission))) {
    throw new ForbiddenException('لا تملك صلاحية تنفيذ هذه العملية');
  }
  return ledger;
}

export async function hasPermission(
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
