import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { MockEmailProvider } from '../email/email.provider.js';
import { EmailService } from '../email/email.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'user@example.com';

type TokenRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function makePrisma() {
  const users = [
    { id: USER_ID, email: EMAIL, status: 'ACTIVE', locale: 'ar', passwordHash: null as string | null },
  ];
  const tokens: TokenRow[] = [];
  const sessions: Array<{ id: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null }> = [];
  let counter = 0;

  const prisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.email) return users.find((u) => u.email === where.email) ?? null;
        if (where.id) return users.find((u) => u.id === where.id) ?? null;
        return null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { passwordHash?: string } }) => {
        const user = users.find((u) => u.id === where.id)!;
        if (data.passwordHash !== undefined) user.passwordHash = data.passwordHash;
        return user;
      }),
    },
    passwordResetToken: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) =>
        tokens.find((t) => t.tokenHash === where.tokenHash) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Omit<TokenRow, 'id' | 'usedAt' | 'revokedAt' | 'createdAt'> }) => {
        const row: TokenRow = {
          id: `tok-${++counter}`,
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          usedAt: null,
          revokedAt: null,
          createdAt: new Date(),
        };
        tokens.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<TokenRow> }) => {
        const row = tokens.find((t) => t.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { userId: string; usedAt: null; revokedAt: null }; data: Partial<TokenRow> }) => {
        let count = 0;
        for (const t of tokens) {
          if (t.userId === where.userId && t.usedAt === null && t.revokedAt === null) {
            Object.assign(t, data);
            count += 1;
          }
        }
        return { count };
      }),
    },
    userSession: {
      create: vi.fn(async ({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
        const row = { id: `s-${++counter}`, userId: data.userId, tokenHash: data.tokenHash, expiresAt: data.expiresAt, revokedAt: null };
        sessions.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { userId: string; revokedAt: null }; data: { revokedAt: Date } }) => {
        let count = 0;
        for (const s of sessions) {
          if (s.userId === where.userId && s.revokedAt === null) {
            s.revokedAt = data.revokedAt;
            count += 1;
          }
        }
        return { count };
      }),
      findFirst: vi.fn(async ({ where }: { where: { tokenHash: string; revokedAt: null; expiresAt: { gt: Date } } }) =>
        sessions.find((s) => s.tokenHash === where.tokenHash && s.revokedAt === null && s.expiresAt.getTime() > where.expiresAt.gt.getTime()) ?? null,
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<{ revokedAt: Date }> }) => {
        const row = sessions.find((s) => s.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    $transaction: vi.fn(async (ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops) : (ops as (tx: unknown) => Promise<unknown>)(prisma),
    ),
  };

  return { prisma, users, tokens, sessions };
}

function makeService() {
  const { prisma, users, tokens, sessions } = makePrisma();
  const provider = new MockEmailProvider();
  const email = new EmailService(provider);
  const svc = new AuthService(prisma as never, email);
  return { svc, prisma, provider, users, tokens, sessions };
}

function extractToken(url: string): string {
  const match = /token=([0-9a-f]+)/.exec(url);
  if (!match) throw new Error('no token in reset url');
  return match[1];
}

describe('AuthService forgot/reset password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('يبني ردًا موحّدًا لبريد موجود ويخزّن الـhash فقط', async () => {
    const { svc, provider, tokens } = makeService();
    const result = await svc.forgotPassword({ email: EMAIL });

    expect(result.message).toBeTruthy();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).toHaveLength(64);

    const raw = extractToken(provider.sent[0].text);
    expect(tokens[0].tokenHash).toBe(sha256(raw));
    expect(tokens[0].tokenHash).not.toBe(raw);
    expect(provider.sent[0].to).toBe(EMAIL);
  });

  it('يعيد الرد نفسه تمامًا لبريد غير موجود دون إنشاء رمز', async () => {
    const { svc, provider, tokens } = makeService();
    const existing = await svc.forgotPassword({ email: EMAIL });
    const missing = await svc.forgotPassword({ email: 'nobody@example.com' });

    expect(missing.message).toBe(existing.message);
    expect(tokens).toHaveLength(1);
    expect(provider.sent).toHaveLength(1);
  });

  it('يُبطل الرمز السابق غير المستهلك قبل إصدار رمز جديد', async () => {
    const { svc, tokens } = makeService();
    await svc.forgotPassword({ email: EMAIL });
    await svc.forgotPassword({ email: EMAIL });

    expect(tokens).toHaveLength(2);
    expect(tokens[0].revokedAt).not.toBeNull();
    expect(tokens[1].revokedAt).toBeNull();
  });

  it('لا يكشف فشل الإرسال ولا يغيّر الرد الموحّد', async () => {
    const { svc, tokens } = makeService();
    vi.spyOn(EmailService.prototype, 'sendPasswordReset').mockRejectedValueOnce(new Error('boom'));
    const result = await svc.forgotPassword({ email: EMAIL });
    expect(result.message).toBeTruthy();
    expect(tokens).toHaveLength(1);
  });

  it('يغيّر كلمة المرور ويستهلك الرمز ويُبطل الجلسات عند النجاح', async () => {
    const { svc, provider, tokens, users, sessions } = makeService();
    await svc.forgotPassword({ email: EMAIL });
    const raw = extractToken(provider.sent[0].text);

    sessions.push({ id: 's-old', userId: USER_ID, tokenHash: 'x'.repeat(64), expiresAt: new Date(Date.now() + 1000), revokedAt: null });

    const result = await svc.resetPassword({ token: raw, password: 'n3w-secret' });

    expect(result).toEqual({ success: true });
    expect(tokens[0].usedAt).not.toBeNull();
    expect(sessions[0].revokedAt).not.toBeNull();

    // كلمة المرور الجديدة تعمل، والقديمة لا.
    const ok = await svc.login({ email: EMAIL, password: 'n3w-secret' });
    expect(ok.accessToken).toBeTruthy();
    await expect(svc.login({ email: EMAIL, password: 'wrong-secret' })).rejects.toBeTruthy();
    expect(users[0].passwordHash).not.toBeNull();
  });

  it('يرفض رمزًا غير معروف', async () => {
    const { svc } = makeService();
    await expect(svc.resetPassword({ token: 'deadbeef', password: 'x1234567' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('يرفض رمزًا منتهي الصلاحية', async () => {
    const { svc, provider, tokens } = makeService();
    await svc.forgotPassword({ email: EMAIL });
    tokens[0].expiresAt = new Date(Date.now() - 1000);
    const raw = extractToken(provider.sent[0].text);
    await expect(svc.resetPassword({ token: raw, password: 'x1234567' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('يرفض إعادة استخدام الرمز نفسه', async () => {
    const { svc, provider } = makeService();
    await svc.forgotPassword({ email: EMAIL });
    const raw = extractToken(provider.sent[0].text);
    await svc.resetPassword({ token: raw, password: 'first-pass' });
    await expect(svc.resetPassword({ token: raw, password: 'second-pass' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('يُبطل أي رموز أخرى غير مستهلكة بعد الاستعادة', async () => {
    const { svc, provider, tokens } = makeService();
    await svc.forgotPassword({ email: EMAIL });
    const first = extractToken(provider.sent[0].text);
    await svc.forgotPassword({ email: EMAIL });
    const second = extractToken(provider.sent[1].text);

    await svc.resetPassword({ token: second, password: 'only-pass' });

    const used = tokens.find((t) => t.tokenHash === sha256(second));
    const other = tokens.find((t) => t.tokenHash === sha256(first));
    expect(used?.usedAt).not.toBeNull();
    expect(other?.revokedAt).not.toBeNull();
  });

  it('يرفض كلمة مرور فارغة', async () => {
    const { svc } = makeService();
    await expect(svc.resetPassword({ token: 'abc', password: '' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
