import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LedgerMembersService } from './ledger-members.service.js';
import { EmailService } from '../email/email.service.js';
import type { EmailMessage, EmailProvider, EmailSendResult } from '../email/email.provider.js';

const LEDGER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '33333333-3333-4333-8333-333333333333';
const INVITEE_ID = '55555555-5555-4555-8555-555555555555';
const INVITE_ID = '66666666-6666-4666-8666-666666666666';
const OWNER_EMAIL = 'owner@example.com';
const INVITEE_EMAIL = 'invitee@example.com';

function makePrisma() {
  const invitations: Array<Record<string, unknown>> = [];
  const prisma = {
    ledger: {
      findUnique: vi.fn(async () => ({ id: LEDGER_ID, ownerId: OWNER_ID, name: 'دفتر العائلة' })),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.email) return { id: INVITEE_ID, email: INVITEE_EMAIL };
        if (where.id) return { id: OWNER_ID, email: OWNER_EMAIL, locale: 'ar' };
        return null;
      }),
    },
    ledgerMember: { findUnique: vi.fn(async () => null) },
    invitation: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: INVITE_ID,
          ledgerId: data.ledgerId,
          email: data.email,
          status: data.status,
          permissions: data.permissions,
          expiresAt: data.expiresAt,
          usedAt: null,
          revokedAt: null,
        };
        invitations.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = invitations.find((i) => i.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
  };
  return { prisma, invitations };
}

class CapturingProvider implements EmailProvider {
  readonly name = 'capturing';
  readonly sent: EmailMessage[] = [];
  readonly shouldFail: boolean;
  constructor(shouldFail = false) {
    this.shouldFail = shouldFail;
  }
  isConfigured(): boolean {
    return true;
  }
  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (this.shouldFail) throw new Error('mail down');
    this.sent.push({ ...message });
    return { provider: this.name, messageId: 'm1' };
  }
}

function makeService(shouldFail = false) {
  const { prisma, invitations } = makePrisma();
  const provider = new CapturingProvider(shouldFail);
  const svc = new LedgerMembersService(prisma as never, new EmailService(provider));
  return { svc, provider, invitations };
}

describe('LedgerMembersService invitation email', () => {
  beforeEach(() => vi.clearAllMocks());

  it('يرسل بريد دعوة عبر المزوّد ويُبقي الدعوة PENDING', async () => {
    const { svc, provider, invitations } = makeService();
    const result = await svc.invite(LEDGER_ID, OWNER_ID, { email: INVITEE_EMAIL, permissions: ['ENTRY_VIEW'] as never });

    expect(result.emailSent).toBe(true);
    expect(result.status).toBe('PENDING');
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].to).toBe(INVITEE_EMAIL);
    expect(provider.sent[0].text).toContain(`/ledgers/${LEDGER_ID}`);
    expect(invitations[0].status).toBe('PENDING');
    // لا يُعاد الرمز الخام ولا الـhash في الرد.
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('tokenHash');
  });

  it('لا يقبل الدعوة ولا يرمي خطأ عند فشل البريد', async () => {
    const { svc, invitations } = makeService(true);
    const result = await svc.invite(LEDGER_ID, OWNER_ID, { email: INVITEE_EMAIL });

    expect(result.emailSent).toBe(false);
    expect(result.status).toBe('PENDING');
    expect(invitations[0].status).toBe('PENDING');
  });

  it('يعمل بلا مزوّد بريد مضبوط دون كسر الدعوة', async () => {
    const { prisma, invitations } = makePrisma();
    const svc = new LedgerMembersService(prisma as never);
    const result = await svc.invite(LEDGER_ID, OWNER_ID, { email: INVITEE_EMAIL });
    expect(result.emailSent).toBe(false);
    expect(invitations[0].status).toBe('PENDING');
  });
});
