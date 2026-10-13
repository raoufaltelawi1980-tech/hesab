/**
 * قوالب البريد (عربي/إنجليزي). القوالب نصّية صافية، ولا تحمل أي سرّ أو مفتاح مزوّد.
 * الرابط الوحيد الذي قد يحمل رمزًا هو رابط الاستعادة/الدعوة، وهو الغرض المقصود.
 * لا يُخزَّن نصّ الرسالة ولا رمزها في قاعدة البيانات ولا في السجلات.
 */
export type EmailLocale = 'ar' | 'en';

export function normalizeEmailLocale(value?: string | null): EmailLocale {
  return value === 'en' ? 'en' : 'ar';
}

export type EmailTemplate = {
  subject: string;
  text: string;
};

export function passwordResetTemplate(input: {
  locale?: string | null;
  resetUrl: string;
  expiresInMinutes: number;
}): EmailTemplate {
  const locale = normalizeEmailLocale(input.locale);
  if (locale === 'en') {
    return {
      subject: 'Reset your Hesab password',
      text: [
        'We received a request to reset your Hesab password.',
        '',
        `Open this link to choose a new password (valid for ${input.expiresInMinutes} minutes):`,
        input.resetUrl,
        '',
        'If you did not request this, you can safely ignore this email. Your password stays unchanged.',
      ].join('\n'),
    };
  }
  return {
    subject: 'استعادة كلمة مرور حساب',
    text: [
      'وصلنا طلب لاستعادة كلمة مرور حسابك في «حساب».',
      '',
      `افتح هذا الرابط لاختيار كلمة مرور جديدة (صالح لمدة ${input.expiresInMinutes} دقيقة):`,
      input.resetUrl,
      '',
      'إذا لم تطلب ذلك فتجاهل هذه الرسالة بأمان؛ كلمة مرورك تبقى كما هي.',
    ].join('\n'),
  };
}

export function memberInvitationTemplate(input: {
  locale?: string | null;
  ledgerName: string;
  inviterEmail: string;
  inviteUrl: string;
}): EmailTemplate {
  const locale = normalizeEmailLocale(input.locale);
  const ledgerName = input.ledgerName.trim() || (locale === 'en' ? 'a ledger' : 'دفتر');
  if (locale === 'en') {
    return {
      subject: `Invitation to join "${ledgerName}" on Hesab`,
      text: [
        `${input.inviterEmail} invited you to join the ledger "${ledgerName}" on Hesab.`,
        '',
        'Sign in with this email address, then open the ledger to accept the invitation:',
        input.inviteUrl,
        '',
        'If you were not expecting this invitation, you can ignore it.',
      ].join('\n'),
    };
  }
  return {
    subject: 'دعوة للانضمام إلى دفتر',
    text: [
      `دعاك ${input.inviterEmail} للانضمام إلى دفتر «${input.ledgerName}».`,
      '',
      'سجّل الدخول ببريدك هذا، ثم افتح الدفتر لقبول الدعوة:',
      input.inviteUrl,
      '',
      'إن لم تكن تتوقّع هذه الدعوة فيمكنك تجاهلها.',
    ].join('\n'),
  };
}
