import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/// مدة صلاحية رمز الاستعادة — ساعة واحدة.
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/// رد موحّد لا يكشف وجود البريد من عدمه.
const PASSWORD_RESET_MESSAGE = 'إذا كان البريد مسجّلًا فسيصلك رابط لاستعادة كلمة المرور.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly email?: EmailService,
  ) {}

  private hashPassword(password: string): string {
    const salt = randomBytes(16);
    const derived = scryptSync(password, salt, 64);
    return salt.toString('hex') + ':' + derived.toString('hex');
  }

  private verifyPassword(password: string, stored: string): boolean {
    const [saltHex, hashHex] = stored.split(':');
    if (!saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const hash = Buffer.from(hashHex, 'hex');
    const derived = scryptSync(password, salt, 64);
    if (derived.length !== hash.length) return false;
    try {
      return timingSafeEqual(derived, hash);
    } catch {
      return false;
    }
  }

  private sha256Hex(input: string): string {
    const { createHash } = awaitImport();
    return createHash('sha256').update(input).digest('hex');
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');
    const passwordHash = this.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        locale: dto.preferredLanguage ?? 'ar',
        isTopOwner: false,
        status: 'ACTIVE',
      },
      select: { id: true, email: true, createdAt: true },
    });
    return { user };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Invalid credentials');
    if (!this.verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const refreshToken = randomBytes(48).toString('hex');
    const tokenHash = this.sha256Hex(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.userSession.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });
    return {
      accessToken: refreshToken, // simplified for this task; documented as refresh-like
      refreshToken,
      user: { id: user.id, email: user.email },
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Unauthorized');
    const tokenHash = this.sha256Hex(refreshToken);
    const session = await this.prisma.userSession.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Unauthorized');
    }
    const newRefresh = randomBytes(48).toString('hex');
    const newHash = this.sha256Hex(newRefresh);
    const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.$transaction([
      this.prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } }),
      this.prisma.userSession.create({ data: { userId: session.userId, tokenHash: newHash, expiresAt: newExpires } }),
    ]);
    return { accessToken: newRefresh, refreshToken: newRefresh };
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return { success: true };
    const tokenHash = this.sha256Hex(refreshToken);
    await this.prisma.userSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
    return { success: true };
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, createdAt: true } });
  }

  private resetUrl(rawToken: string): string {
    const base = (process.env.WEB_APP_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
    return `${base}/reset-password?token=${rawToken}`;
  }

  /**
   * يبدأ استعادة كلمة المرور. الرد **واحد دائمًا** (`202`) سواء وُجد البريد أم لا،
   * فلا يُكشف وجود الحساب. عند وجود المستخدم: يُبطل أي رمز سابق غير مستهلك،
   * ثم يُخزَّن hash الرمز فقط. لا يُغيّر كلمة المرور هنا، ولا تُسجَّل أي أسرار.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = typeof dto?.email === 'string' ? dto.email.trim().toLowerCase() : '';
    if (email) {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (user && user.status === 'ACTIVE') {
        const now = new Date();
        await this.prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null, revokedAt: null },
          data: { revokedAt: now },
        });
        const rawToken = randomBytes(32).toString('hex');
        await this.prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: this.sha256Hex(rawToken),
            expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
          },
        });
        try {
          await this.email?.sendPasswordReset({
            to: user.email,
            locale: user.locale,
            resetUrl: this.resetUrl(rawToken),
            expiresInMinutes: PASSWORD_RESET_TTL_MS / 60000,
          });
        } catch {
          // فشل الإرسال أو غياب المزوّد لا يكشف شيئًا ولا يغيّر الرد الموحّد.
        }
      }
    }
    return { message: PASSWORD_RESET_MESSAGE };
  }

  /**
   * يُنفّذ الاستعادة برمز سليم فقط: غير مستهلك وغير ملغى وغير منتهٍ.
   * يحدّث كلمة المرور، ويستهلك الرمز، ويُبطل بقية الرموز، ويُلغي كل جلسات الدخول.
   * لا يُعيد الرمز ولا كلمة المرور أبدًا.
   */
  async resetPassword(dto: ResetPasswordDto) {
    const token = typeof dto?.token === 'string' ? dto.token.trim() : '';
    const password = typeof dto?.password === 'string' ? dto.password : '';
    if (!token || !password) throw new BadRequestException('طلب غير صالح');

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.sha256Hex(token) },
    });
    const now = new Date();
    if (!record || record.usedAt || record.revokedAt || record.expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException('رمز الاستعادة غير صالح أو منتهي');
    }

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || user.status !== 'ACTIVE') throw new BadRequestException('طلب غير صالح');

    const passwordHash = this.hashPassword(password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: now } }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.userSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    return { success: true };
  }
}

function awaitImport(): typeof import('crypto') {
  // runtime import not needed, just reference
  return require('crypto');
}
