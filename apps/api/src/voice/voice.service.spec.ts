import { ConflictException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { TransactionsService } from '../transactions/transactions.service.js';
import type { TranscriptionProvider } from './transcription.provider.js';
import { VoiceService } from './voice.service.js';
import { VOICE_MAX_BYTES } from './voice.constants.js';

const LEDGER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_LEDGER_ID = '22222222-2222-4222-8222-222222222222';
const OWNER_ID = '33333333-3333-4333-8333-333333333333';
const MEMBER_ID = '44444444-4444-4444-8444-444444444444';
const CURRENCY_ID = '55555555-5555-4555-8555-555555555555';
const ACCOUNT_ID = '66666666-6666-4666-8666-666666666666';
const CATEGORY_ID = '77777777-7777-4777-8777-777777777777';
const CONTACT_ID = '88888888-8888-4888-8888-888888888888';
const PRODUCT_ID = '99999999-9999-4999-8999-999999999999';
const DRAFT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

type LedgerRow = {
  id: string;
  ownerId: string;
  type: string;
  baseCurrencyId: string;
  stockEnabled: boolean;
};

function makeLedger(overrides: Partial<LedgerRow> = {}): LedgerRow {
  return {
    id: LEDGER_ID,
    ownerId: OWNER_ID,
    type: 'BUSINESS',
    baseCurrencyId: CURRENCY_ID,
    stockEnabled: true,
    ...overrides,
  };
}

function makeFile(overrides: Partial<{ originalname: string; mimetype: string; size: number }> = {}) {
  const size = overrides.size ?? 1024;
  return {
    originalname: overrides.originalname ?? 'clip.webm',
    mimetype: overrides.mimetype ?? 'audio/webm',
    size,
    buffer: Buffer.alloc(size, 1),
  };
}

function createPrisma(options: {
  ledger?: LedgerRow | null;
  memberPermissions?: { permission: string; revokedAt: Date | null }[] | null;
  existingCard?: boolean;
}) {
  const ledger = options.ledger === undefined ? makeLedger() : options.ledger;
  const auditCreate = vi.fn(async () => ({ id: 'audit-1' }));
  const findFirst = vi.fn(async () => (options.existingCard ? { id: 'audit-0' } : null));

  const prisma = {
    ledger: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        ledger && where.id === ledger.id ? ledger : null,
      ),
    },
    ledgerMember: {
      findUnique: vi.fn(async () =>
        options.memberPermissions
          ? { ledgerId: LEDGER_ID, userId: MEMBER_ID, permissions: options.memberPermissions }
          : null,
      ),
    },
    currency: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === CURRENCY_ID ? { id: CURRENCY_ID, code: 'KWD' } : null,
      ),
    },
    financialAccount: {
      findMany: vi.fn(async () => [{ id: ACCOUNT_ID, name: 'الصندوق' }]),
    },
    category: {
      findMany: vi.fn(async () => [{ id: CATEGORY_ID, name: 'المبيعات', items: [] }]),
    },
    contact: {
      findMany: vi.fn(async () => [{ id: CONTACT_ID, name: 'شركة الوفاء', kind: 'CUSTOMER' }]),
    },
    product: {
      findMany: vi.fn(async () => [{ id: PRODUCT_ID, name: 'قلم' }]),
    },
    transactionAuditLog: {
      findFirst,
      create: auditCreate,
    },
  };

  return { prisma: prisma as unknown as PrismaService, auditCreate, findFirst };
}

function createContext(options: Parameters<typeof createPrisma>[0] = {}) {
  const { prisma, auditCreate, findFirst } = createPrisma(options);
  const createDraft = vi.fn(async () => ({
    message: 'مسودة',
    review: { kind: 'INCOME', amount: '50000' },
    draft: { id: DRAFT_ID },
  }));
  const transactions = { createDraft } as unknown as TransactionsService;
  const transcribe = vi.fn(async () => ({ text: 'وارد 100', language: 'ar', confidence: 0.8 }));
  const providerMock = {
    name: 'test',
    isConfigured: () => true,
    transcribe,
  } as unknown as TranscriptionProvider;
  const svc = new VoiceService(prisma, transactions, providerMock);
  return { svc, createDraft, transcribe, auditCreate, findFirst };
}

describe('VoiceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('transcribe', () => {
    it('يرفض غياب الملف الصوتي', async () => {
      const { svc } = createContext();
      await expect(svc.transcribe(LEDGER_ID, OWNER_ID, undefined)).rejects.toThrow(/VOICE_AUDIO_REQUIRED/);
    });

    it('يرفض الملفات الأكبر من الحدّ', async () => {
      const { svc } = createContext();
      const file = makeFile({ size: VOICE_MAX_BYTES + 1 });
      await expect(svc.transcribe(LEDGER_ID, OWNER_ID, file)).rejects.toThrow(/VOICE_AUDIO_TOO_LARGE/);
    });

    it('يرفض الصيغ غير المدعومة', async () => {
      const { svc } = createContext();
      const file = makeFile({ originalname: 'note.txt', mimetype: 'text/plain' });
      await expect(svc.transcribe(LEDGER_ID, OWNER_ID, file)).rejects.toThrow(
        /VOICE_AUDIO_TYPE_UNSUPPORTED/,
      );
    });

    it('يفوّض النص للمزوّد ويعيد النتيجة دون تخزين الصوت', async () => {
      const { svc, transcribe } = createContext();
      const result = await svc.transcribe(LEDGER_ID, OWNER_ID, makeFile());
      expect(transcribe).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ text: 'وارد 100', language: 'ar', confidence: 0.8 });
    });

    it('يمنع الأعضاء من دون صلاحية', async () => {
      const { svc } = createContext({ memberPermissions: [{ permission: 'ENTRY_VIEW', revokedAt: null }] });
      await expect(svc.transcribe(LEDGER_ID, MEMBER_ID, makeFile())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('parse', () => {
    it('يبني بطاقة قابلة للتأكيد ويطابق الحساب والتصنيف دون إنشاء أي مسودة', async () => {
      const { svc, createDraft } = createContext();
      const { card } = await svc.parse(LEDGER_ID, OWNER_ID, {
        text: 'وارد 50000 حساب الصندوق تصنيف المبيعات',
      });

      expect(card.kind).toBe('INCOME');
      expect(card.amount).toBe('50000');
      expect(card.currencyCode).toBe('KWD');
      expect(card.financialAccountId).toBe(ACCOUNT_ID);
      expect(card.categoryId).toBe(CATEGORY_ID);
      expect(card.confirmable).toBe(true);
      expect(card.cardId).toHaveLength(64);
      expect(createDraft).not.toHaveBeenCalled();
    });

    it('يجعل البطاقة غير قابلة للتأكيد عند نقص النوع أو المبلغ', async () => {
      const { svc } = createContext();
      const { card } = await svc.parse(LEDGER_ID, OWNER_ID, { text: '50000' });
      expect(card.kind).toBeNull();
      expect(card.confirmable).toBe(false);
      expect(card.missingFields).toContain('kind');
    });

    it('يرفض النص الفارغ', async () => {
      const { svc } = createContext();
      await expect(svc.parse(LEDGER_ID, OWNER_ID, { text: '   ' })).rejects.toThrow(
        /VOICE_TEXT_REQUIRED/,
      );
    });
  });

  describe('confirm', () => {
    const dto = {
      kind: 'INCOME' as const,
      amount: '50000',
      currencyCode: 'KWD',
      financialAccountId: ACCOUNT_ID,
      categoryId: CATEGORY_ID,
    };

    it('ينشئ مسودة بمصدر VOICE ويسجّل أثرًا بمعرّف البطاقة', async () => {
      const { svc, createDraft, auditCreate } = createContext();
      const result = await svc.confirm(LEDGER_ID, OWNER_ID, { ...dto });

      expect(createDraft).toHaveBeenCalledTimes(1);
      const [ledgerArg, actorArg, dtoArg, optArg] = createDraft.mock.calls[0] as unknown as [
        string,
        string,
        { type: string },
        { source: string },
      ];
      expect(ledgerArg).toBe(LEDGER_ID);
      expect(actorArg).toBe(OWNER_ID);
      expect(dtoArg.type).toBe('INCOME');
      expect(optArg).toEqual({ source: 'VOICE' });

      expect(auditCreate).toHaveBeenCalledTimes(1);
      const auditData = (auditCreate.mock.calls[0] as unknown as [{ data: { payload: { source: string; cardId: string } } }])[0]
        .data;
      expect(auditData.payload.source).toBe('VOICE');
      expect(auditData.payload.cardId).toHaveLength(64);
      expect(result.draft).toEqual({ id: DRAFT_ID });
    });

    it('يمنع تأكيد البطاقة مرتين', async () => {
      const { svc, createDraft } = createContext({ existingCard: true });
      await expect(svc.confirm(LEDGER_ID, OWNER_ID, { ...dto })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(createDraft).not.toHaveBeenCalled();
    });

    it('يرفض البطاقة الناقصة', async () => {
      const { svc } = createContext();
      await expect(svc.confirm(LEDGER_ID, OWNER_ID, { ...dto, amount: '0' })).rejects.toThrow(
        /VOICE_CARD_INCOMPLETE/,
      );
    });

    it('يمنع الأعضاء من دون صلاحية', async () => {
      const { svc } = createContext({ memberPermissions: null });
      await expect(svc.confirm(LEDGER_ID, MEMBER_ID, { ...dto })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('يعزل الدفاتر فلا يمرّ معرّف دفتر آخر', async () => {
      const { svc } = createContext({
        ledger: makeLedger({ id: OTHER_LEDGER_ID, ownerId: 'b'.repeat(8) + '-0000-4000-8000-000000000000' }),
      });
      await expect(svc.confirm(LEDGER_ID, OWNER_ID, { ...dto })).rejects.toThrow(/الدفتر غير موجود/);
    });
  });
});
