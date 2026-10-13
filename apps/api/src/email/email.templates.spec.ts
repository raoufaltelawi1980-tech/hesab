import { describe, expect, it } from 'vitest';
import { memberInvitationTemplate, passwordResetTemplate } from './email.templates.js';

describe('passwordResetTemplate', () => {
  it('يبني قالبًا عربيًا مع الرابط ومدة الصلاحية', () => {
    const { subject, text } = passwordResetTemplate({
      locale: 'ar',
      resetUrl: 'https://app.example/reset-password?token=abc',
      expiresInMinutes: 60,
    });
    expect(subject).toContain('استعادة');
    expect(text).toContain('https://app.example/reset-password?token=abc');
    expect(text).toContain('60');
  });

  it('يبني قالبًا إنجليزيًا', () => {
    const { subject, text } = passwordResetTemplate({
      locale: 'en',
      resetUrl: 'https://app.example/reset-password?token=abc',
      expiresInMinutes: 60,
    });
    expect(subject).toBe('Reset your Hesab password');
    expect(text).toContain('https://app.example/reset-password?token=abc');
  });

  it('يعود إلى العربية عند غياب اللغة', () => {
    const { subject } = passwordResetTemplate({ resetUrl: 'x', expiresInMinutes: 60 });
    expect(subject).toContain('استعادة');
  });
});

describe('memberInvitationTemplate', () => {
  it('يبني دعوة عربية مع اسم الدفتر والمُرسل والرابط', () => {
    const { subject, text } = memberInvitationTemplate({
      locale: 'ar',
      ledgerName: 'دفتر المنزل',
      inviterEmail: 'owner@example.com',
      inviteUrl: 'https://app.example/ledgers/l1',
    });
    expect(subject).toContain('دعوة');
    expect(text).toContain('دفتر المنزل');
    expect(text).toContain('owner@example.com');
    expect(text).toContain('https://app.example/ledgers/l1');
  });

  it('يبني دعوة إنجليزية', () => {
    const { subject, text } = memberInvitationTemplate({
      locale: 'en',
      ledgerName: 'Home Ledger',
      inviterEmail: 'owner@example.com',
      inviteUrl: 'https://app.example/ledgers/l1',
    });
    expect(subject).toBe('Invitation to join "Home Ledger" on Hesab');
    expect(text).toContain('Home Ledger');
  });
});
