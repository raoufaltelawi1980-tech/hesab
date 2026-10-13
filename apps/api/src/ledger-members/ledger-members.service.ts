import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { InvitationStatus, MembershipStatus, Permission } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { InviteMemberDto } from './dto/invite-member.dto.js';
import { UpdatePermissionsDto } from './dto/update-permissions.dto.js';

/**
 * المصدر الوحيد لمفردات الصلاحيات هو `Permission` في `schema.prisma`.
 * لا تُكتب أي قيمة نصية غير موجودة في هذا الـenum.
 */
const ALL_PERMS: Permission[] = Object.values(Permission);

/// مدة صلاحية دعوة البريد — 7 أيام.
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** يُخزَّن hash فقط، ولا يُعاد الرمز الخام في أي رد. */
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** رمز دعوة عشوائي يُستخدم لتوليد `tokenHash` فقط. */
function newInvitationToken(): string {
  return randomBytes(32).toString('hex');
}

/** رابط صفحة الدفتر الذي يفتحه المدعوّ بعد تسجيل الدخول. */
function inviteUrl(ledgerId: string): string {
  const base = (process.env.WEB_APP_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/ledgers/${ledgerId}`;
}

@Injectable()
export class LedgerMembersService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly email?: EmailService,
  ) {}

  private isUuid(v: string): boolean {
    try {
      return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
    } catch {
      return false;
    }
  }

  /**
   * يتحقق أن كل اسم صلاحية موجود فعليًا في `Permission` enum، ويُزيل التكرار.
   * أي اسم غير معروف يُرفض بـ400 بدل تجاهله بصمت.
   */
  private parsePermissions(input: unknown): Permission[] {
    if (input === undefined || input === null) return [];
    if (!Array.isArray(input)) throw new BadRequestException('صلاحيات غير صالحة');
    const out: Permission[] = [];
    for (const raw of input) {
      if (typeof raw !== 'string') throw new BadRequestException('صلاحيات غير صالحة');
      const match = ALL_PERMS.find((p) => p === raw);
      if (!match) throw new BadRequestException('صلاحية غير معروفة');
      if (!out.includes(match)) out.push(match);
    }
    return out;
  }

  private async loadOwnedLedger(ledgerId: string, actorId: string) {
    if (!this.isUuid(ledgerId)) throw new NotFoundException('Ledger not found');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('Ledger not found');
    if (l.ownerId !== actorId) throw new ForbiddenException();
    return l;
  }

  async list(ledgerId: string, actorId: string) {
    await this.loadOwnedLedger(ledgerId, actorId);
    return this.prisma.ledgerMember.findMany({
      where: { ledgerId },
      include: { user: { select: { id: true, email: true } }, permissions: true },
    });
  }

  async get(ledgerId: string, memberId: string, actorId: string) {
    if (!this.isUuid(ledgerId) || !this.isUuid(memberId)) throw new NotFoundException('Not found');
    await this.loadOwnedLedger(ledgerId, actorId);
    const m = await this.prisma.ledgerMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true, email: true } }, permissions: true },
    });
    if (!m || m.ledgerId !== ledgerId) throw new NotFoundException('Not found');
    return m;
  }

  /**
   * يُنشئ دعوة بحالة PENDING بدل إضافة العضوية مباشرة.
   * يُخزَّن hash الرمز فقط، والرمز الخام لا يُعاد في أي رد.
   * يُمنع وجود دعوة نشطة مكررة لنفس (الدفتر، البريد)، وتُؤجَّل المنتهية إلى EXPIRED.
   */
  async invite(ledgerId: string, actorId: string, dto: InviteMemberDto) {
    const ledger = await this.loadOwnedLedger(ledgerId, actorId);
    const rawEmail = typeof dto?.email === 'string' ? dto.email.trim().toLowerCase() : '';
    if (!rawEmail) throw new BadRequestException('بريد غير صالح');
    const permissions = this.parsePermissions(dto?.permissions);

    const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
    if (actor?.email && rawEmail === actor.email.toLowerCase()) throw new BadRequestException('بريد غير صالح');

    const target = await this.prisma.user.findUnique({ where: { email: rawEmail } });
    if (!target) throw new BadRequestException('بريد غير صالح');

    const existing = await this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId: target.id } },
    });
    if (existing) throw new BadRequestException('عضو بالفعل');

    const now = new Date();
    const pending = await this.prisma.invitation.findFirst({
      where: { ledgerId, email: rawEmail, status: InvitationStatus.PENDING, revokedAt: null, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (pending) {
      if (pending.expiresAt.getTime() > now.getTime()) throw new BadRequestException('دعوة نشطة موجودة');
      await this.prisma.invitation.update({
        where: { id: pending.id },
        data: { status: InvitationStatus.EXPIRED },
      });
    }

    const rawToken = newInvitationToken();
    const invitation = await this.prisma.invitation.create({
      data: {
        ledgerId,
        inviterId: actorId,
        email: rawEmail,
        tokenHash: hashToken(rawToken),
        status: InvitationStatus.PENDING,
        permissions,
        expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      },
    });

    // إشعار بالبريد فقط؛ لا تغيّر الدعوة حالتها ولا تُقبل هنا.
    // فشل الإرسال أو غياب المزوّد لا يكشف تفاصيل ولا يُلغي الدعوة.
    let emailSent = false;
    if (this.email) {
      try {
        const inviter = await this.prisma.user.findUnique({
          where: { id: actorId },
          select: { email: true, locale: true },
        });
        await this.email.sendMemberInvitation({
          to: rawEmail,
          locale: inviter?.locale,
          ledgerName: ledger.name ?? '',
          inviterEmail: inviter?.email ?? '',
          inviteUrl: inviteUrl(ledgerId),
        });
        emailSent = true;
      } catch {
        emailSent = false;
      }
    }

    return {
      id: invitation.id,
      ledgerId: invitation.ledgerId,
      email: invitation.email,
      status: invitation.status,
      permissions: invitation.permissions,
      expiresAt: invitation.expiresAt,
      emailSent,
    };
  }

  /** قائمة الدعوات للمالك، بلا `tokenHash` ولا أي سر. */
  async listInvitations(ledgerId: string, actorId: string) {
    await this.loadOwnedLedger(ledgerId, actorId);
    return this.prisma.invitation.findMany({
      where: { ledgerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        status: true,
        permissions: true,
        expiresAt: true,
        usedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * يقبل الدعوة النشطة فقط للمستخدم المصادَق (بريده مطابق لبريد الدعوة).
   * يرفض الملغاة والمستخدمة والمنتهية، ويُنشئ العضوية والصلاحيات في معاملة واحدة.
   */
  async accept(ledgerId: string, actorId: string) {
    if (!this.isUuid(ledgerId)) throw new NotFoundException('Ledger not found');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('Ledger not found');

    const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
    if (!actor?.email) throw new ForbiddenException();
    const email = actor.email.trim().toLowerCase();

    const invitation = await this.prisma.invitation.findFirst({
      where: { ledgerId, email },
      orderBy: { createdAt: 'desc' },
    });
    if (!invitation) throw new NotFoundException('دعوة غير موجودة');

    if (invitation.status === InvitationStatus.REVOKED || invitation.revokedAt) {
      throw new BadRequestException('دعوة ملغاة');
    }
    if (invitation.status === InvitationStatus.ACCEPTED || invitation.usedAt) {
      throw new BadRequestException('دعوة مستخدمة');
    }
    const now = new Date();
    if (invitation.status === InvitationStatus.EXPIRED || invitation.expiresAt.getTime() <= now.getTime()) {
      await this.prisma.invitation.update({ where: { id: invitation.id }, data: { status: InvitationStatus.EXPIRED } });
      throw new BadRequestException('دعوة منتهية');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('دعوة غير نشطة');
    }

    const existing = await this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId: actorId } },
    });
    if (existing) throw new BadRequestException('عضو بالفعل');

    const member = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ledgerMember.create({
        data: {
          ledgerId,
          userId: actorId,
          status: MembershipStatus.ACTIVE,
          invitedAt: invitation.createdAt,
          joinedAt: now,
        },
      });
      for (const permission of invitation.permissions) {
        await tx.ledgerMemberPermission.create({
          data: { memberId: created.id, permission, grantedById: invitation.inviterId },
        });
      }
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED, usedAt: now },
      });
      return created;
    });

    return { accepted: true, memberId: member.id, ledgerId, permissions: invitation.permissions };
  }

  /** يُلغي الدعوة النشطة فقط. الحالة لا تتغيّر بعد الإلغاء أو الاستخدام، والسجل لا يُحذف. */
  async revokeInvitation(ledgerId: string, invitationId: string, actorId: string) {
    if (!this.isUuid(ledgerId) || !this.isUuid(invitationId)) throw new NotFoundException('Not found');
    await this.loadOwnedLedger(ledgerId, actorId);
    const invitation = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.ledgerId !== ledgerId) throw new NotFoundException('Not found');
    if (invitation.status !== InvitationStatus.PENDING || invitation.usedAt) {
      throw new BadRequestException('دعوة غير نشطة');
    }
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
    });
    return { success: true };
  }

  async updatePermissions(ledgerId: string, memberId: string, actorId: string, dto: UpdatePermissionsDto) {
    if (!this.isUuid(ledgerId) || !this.isUuid(memberId)) throw new NotFoundException('Not found');
    await this.loadOwnedLedger(ledgerId, actorId);
    const permissions = this.parsePermissions(dto?.permissions);
    const m = await this.prisma.ledgerMember.findUnique({ where: { id: memberId } });
    if (!m || m.ledgerId !== ledgerId) throw new NotFoundException('Not found');
    if (m.userId === actorId) throw new ForbiddenException();

    await this.prisma.$transaction(async (tx) => {
      await tx.ledgerMemberPermission.updateMany({
        where: { memberId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      for (const permission of permissions) {
        await tx.ledgerMemberPermission.create({
          data: { memberId, permission, grantedById: actorId },
        });
      }
    });
    return { success: true };
  }

  async suspend(ledgerId: string, memberId: string, actorId: string) {
    if (!this.isUuid(ledgerId) || !this.isUuid(memberId)) throw new NotFoundException('Not found');
    await this.loadOwnedLedger(ledgerId, actorId);
    const m = await this.prisma.ledgerMember.findUnique({ where: { id: memberId } });
    if (!m || m.ledgerId !== ledgerId || m.userId === actorId) throw new NotFoundException('Not found');
    await this.prisma.ledgerMember.update({
      where: { id: memberId },
      data: { status: MembershipStatus.SUSPENDED, archivedAt: new Date() },
    });
    return { success: true };
  }

  async remove(ledgerId: string, memberId: string, actorId: string) {
    if (!this.isUuid(ledgerId) || !this.isUuid(memberId)) throw new NotFoundException('Not found');
    await this.loadOwnedLedger(ledgerId, actorId);
    const m = await this.prisma.ledgerMember.findUnique({ where: { id: memberId } });
    if (!m || m.ledgerId !== ledgerId || m.userId === actorId) throw new NotFoundException('Not found');
    await this.prisma.ledgerMember.delete({ where: { id: memberId } });
    return { success: true };
  }

  async myPermissions(ledgerId: string, actorId: string) {
    if (!this.isUuid(ledgerId)) throw new NotFoundException('Ledger not found');
    const l = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!l) throw new NotFoundException('Ledger not found');
    if (l.ownerId === actorId) return { isOwner: true, permissions: ALL_PERMS };
    const m = await this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId: actorId } },
      include: { permissions: true },
    });
    if (!m) throw new ForbiddenException();
    return {
      isOwner: false,
      permissions: m.permissions.filter((p) => !p.revokedAt).map((p) => p.permission),
    };
  }
}