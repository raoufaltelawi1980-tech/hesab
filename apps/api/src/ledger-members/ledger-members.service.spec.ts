import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LedgerMembersService } from './ledger-members.service.js';

const LEDGER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_LEDGER_ID = '22222222-2222-4222-8222-222222222222';
const OWNER_ID = '33333333-3333-4333-8333-333333333333';
const MEMBER_ID = '44444444-4444-4444-8444-444444444444';
const INVITEE_ID = '55555555-5555-4555-8555-555555555555';
const INVITATION_ID = '66666666-6666-4666-8666-666666666666';

const OWNER_EMAIL = 'owner@example.com';
const INVITEE_EMAIL = 'invitee@example.com';
const MEMBER_EMAIL = 'member@example.com';

type MemberRow = {
  id: string;
  ledgerId: string;
  userId: string;
  status: string;
  invitedAt: Date | null;
  joinedAt: Date | null;
  archivedAt: Date | null;
};

type PermRow = {
  id: string;
  memberId: string;
  permission: string;
  grantedById: string | null;
  grantedAt: Date;
  revokedAt: Date | null;
};

type InvitationRow = {
  id: string;
  ledgerId: string;
  inviterId: string;
  email: string;
  tokenHash: string;
  status: string;
  permissions: string[];
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

const now = () => new Date();

function seedInvitation(overrides: Partial<InvitationRow> = {}): InvitationRow {
  return {
    id: INVITATION_ID,
    ledgerId: LEDGER_ID,
    inviterId: OWNER_ID,
    email: INVITEE_EMAIL,
    tokenHash: 'a'.repeat(64),
    status: 'PENDING',
    permissions: ['ENTRY_VIEW'],
    expiresAt: new Date(Date.now() + 86_400_000),
    usedAt: null,
    revokedAt: null,
    createdAt: now(),
    ...overrides,
  };
}

function project<T extends Record<string, unknown>>(row: T, select?: Record<string, boolean>): Record<string, unknown> {
  if (!select) return { ...row };
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(select)) {
    if (select[key]) out[key] = row[key];
  }
  return out;
}

function makePrisma(seed: { invitations?: InvitationRow[]; members?: MemberRow[]; permissions?: PermRow[] } = {}) {
  const state = {
    invitations: [...(seed.invitations ?? [])],
    members: [...(seed.members ?? [])],
    permissions: [...(seed.permissions ?? [])],
  };

  const users = [
    { id: OWNER_ID, email: OWNER_EMAIL },
    { id: INVITEE_ID, email: INVITEE_EMAIL },
    { id: MEMBER_ID, email: MEMBER_EMAIL },
  ];

  const matchInvitation = (row: InvitationRow, where: Record<string, unknown>): boolean => {
    if (where.ledgerId && row.ledgerId !== where.ledgerId) return false;
    if (where.email && row.email !== where.email) return false;
    if (where.status && row.status !== where.status) return false;
    if ('revokedAt' in where && where.revokedAt === null && row.revokedAt !== null) return false;
    if ('usedAt' in where && where.usedAt === null && row.usedAt !== null) return false;
    return true;
  };

  const prisma = {
    ledger: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id !== LEDGER_ID && where.id !== OTHER_LEDGER_ID) return null;
        return { id: where.id, ownerId: OWNER_ID };
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) return users.find((u) => u.id === where.id) ?? null;
        if (where.email) return users.find((u) => u.email === where.email) ?? null;
        return null;
      }),
    },
    ledgerMember: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; ledgerId_userId?: { ledgerId: string; userId: string } } }) => {
        const found = where.id
          ? state.members.find((m) => m.id === where.id)
          : state.members.find((m) => m.ledgerId === where.ledgerId_userId!.ledgerId && m.userId === where.ledgerId_userId!.userId);
        if (!found) return null;
        return { ...found, permissions: state.permissions.filter((p) => p.memberId === found.id) };
      }),
      findMany: vi.fn(async ({ where }: { where: { ledgerId: string } }) =>
        state.members.filter((m) => m.ledgerId === where.ledgerId),
      ),
      create: vi.fn(async ({ data }: { data: Partial<MemberRow> }) => {
        const row: MemberRow = {
          id: MEMBER_ID,
          ledgerId: data.ledgerId!,
          userId: data.userId!,
          status: data.status ?? 'ACTIVE',
          invitedAt: data.invitedAt ?? null,
          joinedAt: data.joinedAt ?? null,
          archivedAt: null,
        };
        state.members.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<MemberRow> }) => {
        const row = state.members.find((m) => m.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        state.members = state.members.filter((m) => m.id !== where.id);
        return { id: where.id };
      }),
    },
    ledgerMemberPermission: {
      create: vi.fn(async ({ data }: { data: Partial<PermRow> }) => {
        const row: PermRow = {
          id: `perm-${state.permissions.length + 1}`,
          memberId: data.memberId!,
          permission: data.permission as string,
          grantedById: data.grantedById ?? null,
          grantedAt: now(),
          revokedAt: null,
        };
        state.permissions.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { memberId: string; revokedAt: null }; data: { revokedAt: Date } }) => {
        let count = 0;
        for (const p of state.permissions) {
          if (p.memberId === where.memberId && p.revokedAt === null) {
            p.revokedAt = data.revokedAt;
            count += 1;
          }
        }
        return { count };
      }),
    },
    invitation: {
      findFirst: vi.fn(async ({ where, orderBy }: { where: Record<string, unknown>; orderBy?: { createdAt: 'asc' | 'desc' } }) => {
        const found = state.invitations.filter((row) => matchInvitation(row, where));
        const ordered = found.sort((a, b) =>
          orderBy?.createdAt === 'asc' ? a.createdAt.getTime() - b.createdAt.getTime() : b.createdAt.getTime() - a.createdAt.getTime(),
        );
        return ordered[0] ?? null;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        state.invitations.find((row) => row.id === where.id) ?? null,
      ),
      findMany: vi.fn(async ({ where, select }: { where: { ledgerId: string }; select?: Record<string, boolean> }) =>
        state.invitations.filter((row) => row.ledgerId === where.ledgerId).map((row) => project(row as unknown as Record<string, unknown>, select)),
      ),
      create: vi.fn(async ({ data }: { data: Partial<InvitationRow> }) => {
        const row: InvitationRow = {
          id: INVITATION_ID,
          ledgerId: data.ledgerId!,
          inviterId: data.inviterId!,
          email: data.email!,
          tokenHash: data.tokenHash!,
          status: data.status ?? 'PENDING',
          permissions: (data.permissions as string[]) ?? [],
          expiresAt: data.expiresAt!,
          usedAt: null,
          revokedAt: null,
          createdAt: now(),
        };
        state.invitations.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<InvitationRow> }) => {
        const row = state.invitations.find((invitation) => invitation.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
  };

  return { prisma, state };
}

function service(seed: Parameters<typeof makePrisma>[0] = {}) {
  const { prisma, state } = makePrisma(seed);
  return { svc: new LedgerMembersService(prisma as never), prisma, state };
}

describe('LedgerMembersService permissions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the full Permission vocabulary to the owner', async () => {
    const { svc } = service();
    const result = await svc.myPermissions(LEDGER_ID, OWNER_ID);
    expect(result.isOwner).toBe(true);
    expect(result.permissions).toContain('ENTRY_CREATE');
    expect(result.permissions).toContain('BUDGET_MANAGE');
    expect(result.permissions).toContain('MEMBER_INVITE');
    expect(result.permissions).not.toContain('CREATE_TRANSACTIONS');
  });

  it('returns only the live granted permissions to a member', async () => {
    const { svc } = service({
      members: [
        { id: MEMBER_ID, ledgerId: LEDGER_ID, userId: MEMBER_ID, status: 'ACTIVE', invitedAt: null, joinedAt: null, archivedAt: null },
      ],
      permissions: [
        { id: 'p1', memberId: MEMBER_ID, permission: 'ENTRY_VIEW', grantedById: OWNER_ID, grantedAt: now(), revokedAt: null },
        { id: 'p2', memberId: MEMBER_ID, permission: 'ENTRY_CONFIRM', grantedById: OWNER_ID, grantedAt: now(), revokedAt: now() },
      ],
    });
    const result = await svc.myPermissions(LEDGER_ID, MEMBER_ID);
    expect(result.isOwner).toBe(false);
    expect(result.permissions).toEqual(['ENTRY_VIEW']);
  });

  it('rejects a non-owner member that holds no permission from listing', async () => {
    const { svc } = service();
    await expect(svc.list(LEDGER_ID, MEMBER_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not leak a member from another ledger', async () => {
    const { svc } = service({
      members: [
        { id: MEMBER_ID, ledgerId: LEDGER_ID, userId: MEMBER_ID, status: 'ACTIVE', invitedAt: null, joinedAt: null, archivedAt: null },
      ],
    });
    await expect(svc.get(OTHER_LEDGER_ID, MEMBER_ID, OWNER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('accepts a valid Permission list and rejects an invalid one', async () => {
    const { svc } = service();
    await expect(
      svc.updatePermissions(LEDGER_ID, MEMBER_ID, OWNER_ID, { permissions: ['NOT_A_PERMISSION' as never] }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const { svc: ok, state } = service({
      members: [
        { id: MEMBER_ID, ledgerId: LEDGER_ID, userId: MEMBER_ID, status: 'ACTIVE', invitedAt: null, joinedAt: null, archivedAt: null },
      ],
    });
    await ok.updatePermissions(LEDGER_ID, MEMBER_ID, OWNER_ID, { permissions: ['ENTRY_VIEW', 'ENTRY_VIEW', 'BUDGET_MANAGE'] as never });
    const live = state.permissions.filter((p) => p.memberId === MEMBER_ID && p.revokedAt === null).map((p) => p.permission);
    expect(live.sort()).toEqual(['BUDGET_MANAGE', 'ENTRY_VIEW']);
  });
});

describe('LedgerMembersService invitations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a PENDING invitation, stores only the token hash and never returns it', async () => {
    const { svc, state } = service();
    const result = await svc.invite(LEDGER_ID, OWNER_ID, { email: INVITEE_EMAIL, permissions: ['ENTRY_VIEW'] as never });

    expect(result.status).toBe('PENDING');
    expect(result.permissions).toEqual(['ENTRY_VIEW']);
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('tokenHash');

    expect(state.invitations).toHaveLength(1);
    const stored = state.invitations[0];
    expect(stored.status).toBe('PENDING');
    expect(stored.tokenHash).toHaveLength(64);
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects an invalid permission on invite', async () => {
    const { svc } = service();
    await expect(
      svc.invite(LEDGER_ID, OWNER_ID, { email: INVITEE_EMAIL, permissions: ['CREATE_TRANSACTIONS' as never] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents a duplicate active invitation for the same ledger and email', async () => {
    const { svc } = service({ invitations: [seedInvitation()] });
    await expect(svc.invite(LEDGER_ID, OWNER_ID, { email: INVITEE_EMAIL })).rejects.toThrow('دعوة نشطة موجودة');
  });

  it('expires a stale pending invitation and allows a fresh one', async () => {
    const { svc, state } = service({
      invitations: [seedInvitation({ expiresAt: new Date(Date.now() - 1000) })],
    });
    await svc.invite(LEDGER_ID, OWNER_ID, { email: INVITEE_EMAIL });
    expect(state.invitations[0].status).toBe('EXPIRED');
    expect(state.invitations).toHaveLength(2);
  });

  it('does not invite someone who is already a member', async () => {
    const { svc } = service({
      members: [
        { id: MEMBER_ID, ledgerId: LEDGER_ID, userId: INVITEE_ID, status: 'ACTIVE', invitedAt: null, joinedAt: null, archivedAt: null },
      ],
    });
    await expect(svc.invite(LEDGER_ID, OWNER_ID, { email: INVITEE_EMAIL })).rejects.toThrow('عضو بالفعل');
  });

  it('accepts an active invitation and grants its permissions', async () => {
    const { svc, state } = service({
      invitations: [seedInvitation({ permissions: ['ENTRY_VIEW', 'BUDGET_MANAGE'] })],
    });
    const result = await svc.accept(LEDGER_ID, INVITEE_ID);

    expect(result.accepted).toBe(true);
    expect(result.permissions).toEqual(['ENTRY_VIEW', 'BUDGET_MANAGE']);

    const member = state.members.find((m) => m.userId === INVITEE_ID)!;
    expect(member.status).toBe('ACTIVE');
    expect(member.joinedAt).not.toBeNull();

    const live = state.permissions.filter((p) => p.memberId === member.id).map((p) => p.permission);
    expect(live.sort()).toEqual(['BUDGET_MANAGE', 'ENTRY_VIEW']);

    const invitation = state.invitations[0];
    expect(invitation.status).toBe('ACCEPTED');
    expect(invitation.usedAt).not.toBeNull();
  });

  it('rejects an expired invitation and marks it EXPIRED', async () => {
    const { svc, state } = service({
      invitations: [seedInvitation({ expiresAt: new Date(Date.now() - 1000) })],
    });
    await expect(svc.accept(LEDGER_ID, INVITEE_ID)).rejects.toThrow('دعوة منتهية');
    expect(state.invitations[0].status).toBe('EXPIRED');
  });

  it('rejects a revoked invitation', async () => {
    const { svc } = service({
      invitations: [seedInvitation({ status: 'REVOKED', revokedAt: now() })],
    });
    await expect(svc.accept(LEDGER_ID, INVITEE_ID)).rejects.toThrow('دعوة ملغاة');
  });

  it('rejects an already-used invitation', async () => {
    const { svc } = service({
      invitations: [seedInvitation({ status: 'ACCEPTED', usedAt: now() })],
    });
    await expect(svc.accept(LEDGER_ID, INVITEE_ID)).rejects.toThrow('دعوة مستخدمة');
  });

  it('revokes a pending invitation and keeps the record', async () => {
    const { svc, state } = service({ invitations: [seedInvitation()] });
    const result = await svc.revokeInvitation(LEDGER_ID, INVITATION_ID, OWNER_ID);

    expect(result.success).toBe(true);
    expect(state.invitations).toHaveLength(1);
    expect(state.invitations[0].status).toBe('REVOKED');
    expect(state.invitations[0].revokedAt).not.toBeNull();
  });

  it('refuses to revoke a non-pending invitation', async () => {
    const { svc } = service({
      invitations: [seedInvitation({ status: 'ACCEPTED', usedAt: now() })],
    });
    await expect(svc.revokeInvitation(LEDGER_ID, INVITATION_ID, OWNER_ID)).rejects.toThrow('دعوة غير نشطة');
  });

  it('lists invitations without exposing the token hash', async () => {
    const { svc } = service({ invitations: [seedInvitation()] });
    const result = await svc.listInvitations(LEDGER_ID, OWNER_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('tokenHash');
    expect(result[0]).toHaveProperty('status', 'PENDING');
  });
});