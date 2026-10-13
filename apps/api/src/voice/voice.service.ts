import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Permission } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import type { CreateDraftDto } from '../transactions/dto/create-draft.dto.js';
import { isDraftKind } from '../transactions/transactions.constants.js';
import { parseVoiceText, normalizeArabic, type RawVoiceParse, type VoiceKind } from './arabic-parser.js';
import {
  VOICE_AUDIO_EXTENSIONS,
  VOICE_AUDIO_MIMETYPES,
  VOICE_KIND_LABEL_AR,
  VOICE_MAX_BYTES,
} from './voice.constants.js';
import { VOICE_ERROR_CODES } from './voice.errors.js';
import { gateVoice, type VoiceLedger } from './voice.gate.js';
import {
  TRANSCRIPTION_PROVIDER,
  type TranscriptionProvider,
} from './transcription.provider.js';
import type { ConfirmVoiceCardDto } from './dto/confirm-voice-card.dto.js';
import type { ParseVoiceDto } from './dto/parse-voice.dto.js';

/** الشكل الذي يصل من مُعترِض الرفع (بلا اعتماد على أنواع multer الخارجية). */
export type UploadedAudioFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type NamedRow = { id: string; name: string };
type ContactRow = { id: string; name: string; kind: string };
type CategoryRow = NamedRow & { items: { id: string; name: string; categoryId: string }[] };

type Catalogs = {
  accounts: NamedRow[];
  categories: CategoryRow[];
  contacts: ContactRow[];
  products: NamedRow[];
};

export type VoiceCard = {
  cardId: string;
  kind: VoiceKind | null;
  kindLabelAr: string | null;
  amount: string | null;
  currencyCode: string | null;
  businessDate: string | null;
  financialAccountId: string | null;
  accountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryItemId: string | null;
  categoryItemName: string | null;
  contactId: string | null;
  contactName: string | null;
  productId: string | null;
  productName: string | null;
  quantity: string | null;
  description: string | null;
  language: string;
  confidence: number;
  missingFields: string[];
  warnings: string[];
  confirmable: boolean;
};

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot < 0 ? '' : filename.slice(dot + 1).toLowerCase();
}

function isPositiveDecimal(value: string | null): boolean {
  if (!value) return false;
  if (!/^\d+(\.\d+)?$/.test(value)) return false;
  return !/^0+(\.0+)?$/.test(value);
}

function resolveByName<T extends NamedRow>(rows: T[], name: string | null): T | null {
  if (!name) return null;
  const target = normalizeArabic(name);
  if (!target) return null;
  return rows.find((row) => normalizeArabic(row.name) === target) ?? null;
}

/** معرّف حتمي للبطاقة من محتواها، يُستخدم لمنع تأكيدها مرتين. */
function canonicalCardId(ledgerId: string, card: ConfirmVoiceCardDto): string {
  const parts = [
    ledgerId,
    card.kind,
    card.amount,
    card.currencyCode,
    card.businessDate ?? '',
    card.financialAccountId,
    card.categoryId,
    card.categoryItemId ?? '',
    card.contactId ?? '',
    card.productId ?? '',
    card.quantity ?? '',
    card.description ?? '',
  ];
  return createHash('sha256').update(parts.join('\u0001')).digest('hex');
}

const CREDIT_CONTACT_KINDS = new Set(['SALE_CREDIT', 'COLLECTION', 'PURCHASE_CREDIT', 'PAYMENT']);

@Injectable()
export class VoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
    @Inject(TRANSCRIPTION_PROVIDER) private readonly provider: TranscriptionProvider,
  ) {}

  /**
   * يتحقّق من الملف الصوتي ثم يفوّضه للمزوّد. لا يُخزَّن الصوت ولا يُسجَّل نصّه،
   * ولا يُكشف سرّ المزوّد في أي ردّ.
   */
  async transcribe(
    ledgerId: string,
    actorId: string,
    file: UploadedAudioFile | undefined,
    language?: string,
  ) {
    await gateVoice(this.prisma, ledgerId, actorId, Permission.ENTRY_CREATE);

    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException(`${VOICE_ERROR_CODES.AUDIO_REQUIRED}: لا يوجد ملف صوتي في الطلب`);
    }
    if (file.size > VOICE_MAX_BYTES) {
      throw new BadRequestException(
        `${VOICE_ERROR_CODES.AUDIO_TOO_LARGE}: حجم الملف يتجاوز الحدّ المسموح (${Math.floor(
          VOICE_MAX_BYTES / (1024 * 1024),
        )} ميجابايت)`,
      );
    }

    const extension = extensionOf(file.originalname);
    const mimetype = (file.mimetype ?? '').toLowerCase();
    const extensionOk = (VOICE_AUDIO_EXTENSIONS as readonly string[]).includes(extension);
    const mimeAllowed =
      VOICE_AUDIO_MIMETYPES.includes(mimetype as (typeof VOICE_AUDIO_MIMETYPES)[number]);
    if (!extension || !extensionOk || (file.mimetype.length > 0 && !mimeAllowed)) {
      throw new BadRequestException(
        `${VOICE_ERROR_CODES.AUDIO_TYPE_UNSUPPORTED}: صيغة الملف غير مدعومة`,
      );
    }

    const result = await this.provider.transcribe({
      buffer: file.buffer,
      mimetype: file.mimetype,
      filename: file.originalname,
      language,
    });

    return {
      text: result.text,
      language: result.language,
      confidence: result.confidence,
    };
  }

  /** يحلّل النص إلى بطاقة مراجعة مكتوبة. لا ينشئ مسودة. */
  async parse(ledgerId: string, actorId: string, dto: ParseVoiceDto): Promise<{ card: VoiceCard }> {
    const ledger = await gateVoice(this.prisma, ledgerId, actorId, Permission.ENTRY_CREATE);
    if (!dto.text || !dto.text.trim()) {
      throw new BadRequestException(`${VOICE_ERROR_CODES.TEXT_REQUIRED}: النص مطلوب`);
    }

    const baseCurrency = await this.prisma.currency.findUnique({
      where: { id: ledger.baseCurrencyId },
    });
    const raw = parseVoiceText(dto.text, { baseCurrencyCode: baseCurrency?.code ?? null });
    const catalogs = await this.loadCatalogs(ledger, ledgerId);
    return { card: this.buildCard(raw, catalogs) };
  }

  /**
   * يؤكّد بطاقة مكتملةفينشئ مسودة حقيقية بمصدر `VOICE` عبر نفس مسار المسودة
   * اليدوي (التحقق الكامل والعزل)، بلا تأكيد وبلا اعتماد وبلا قيد يومية.
   */
  async confirm(ledgerId: string, actorId: string, dto: ConfirmVoiceCardDto) {
    await gateVoice(this.prisma, ledgerId, actorId, Permission.ENTRY_CREATE);

    if (!dto || !isDraftKind(String(dto.kind))) {
      throw new BadRequestException(`${VOICE_ERROR_CODES.CARD_INCOMPLETE}: نوع العملية مطلوب`);
    }
    if (!isPositiveDecimal(dto.amount)) {
      throw new BadRequestException(`${VOICE_ERROR_CODES.CARD_INCOMPLETE}: المبلغ مطلوب وموجب`);
    }
    if (!dto.currencyCode || !dto.currencyCode.trim()) {
      throw new BadRequestException(`${VOICE_ERROR_CODES.CARD_INCOMPLETE}: العملة مطلوبة`);
    }
    if (!dto.financialAccountId) {
      throw new BadRequestException(`${VOICE_ERROR_CODES.CARD_INCOMPLETE}: الحساب مطلوب`);
    }
    if (!dto.categoryId) {
      throw new BadRequestException(`${VOICE_ERROR_CODES.CARD_INCOMPLETE}: التصنيف مطلوب`);
    }

    const cardId = canonicalCardId(ledgerId, dto);
    const already = await this.prisma.transactionAuditLog.findFirst({
      where: {
        ledgerId,
        action: 'CREATE',
        payload: { path: ['cardId'], equals: cardId },
      },
    });
    if (already) {
      throw new ConflictException(
        `${VOICE_ERROR_CODES.CARD_ALREADY_CONFIRMED}: تم تأكيد هذه البطاقة مسبقًا`,
      );
    }

    const draftDto: CreateDraftDto = {
      type: dto.kind,
      financialAccountId: dto.financialAccountId,
      categoryId: dto.categoryId,
      amount: dto.amount,
      currencyCode: dto.currencyCode,
      categoryItemId: dto.categoryItemId,
      contactId: dto.contactId,
      productId: dto.productId,
      quantity: dto.quantity,
      exchangeRate: dto.exchangeRate,
      businessDate: dto.businessDate,
      description: dto.description,
    };

    const result = await this.transactions.createDraft(ledgerId, actorId, draftDto, {
      source: 'VOICE',
    });

    const draftId = (result.draft as { id: string }).id;
    await this.prisma.transactionAuditLog.create({
      data: {
        ledgerId,
        draftId,
        action: 'CREATE',
        actorId,
        payload: { source: 'VOICE', cardId },
      },
    });

    return {
      message: 'تم إنشاء المسودة من الصوت، راجعها قبل التأكيد',
      review: result.review,
      draft: result.draft,
    };
  }

  private async loadCatalogs(ledger: VoiceLedger, ledgerId: string): Promise<Catalogs> {
    const [accounts, categories] = await Promise.all([
      this.prisma.financialAccount.findMany({
        where: { ledgerId, archivedAt: null },
        select: { id: true, name: true },
      }),
      this.prisma.category.findMany({
        where: { ledgerId, archivedAt: null },
        select: {
          id: true,
          name: true,
          items: { where: { archivedAt: null }, select: { id: true, name: true, categoryId: true } },
        },
      }),
    ]);

    let contacts: ContactRow[] = [];
    let products: NamedRow[] = [];
    if (ledger.type === 'BUSINESS') {
      contacts = await this.prisma.contact.findMany({
        where: { ledgerId, archivedAt: null },
        select: { id: true, name: true, kind: true },
      });
      if (ledger.stockEnabled) {
        products = await this.prisma.product.findMany({
          where: { ledgerId, archivedAt: null },
          select: { id: true, name: true },
        });
      }
    }

    return { accounts, categories, contacts, products };
  }

  private buildCard(raw: RawVoiceParse, catalogs: Catalogs): VoiceCard {
    const warnings = [...raw.warnings];
    const missingFields = [...raw.missingFields];

    const account = resolveByName(catalogs.accounts, raw.accountName);
    const category = resolveByName(catalogs.categories, raw.categoryName);
    const contact = resolveByName(catalogs.contacts, raw.contactName);
    const product = resolveByName(catalogs.products, raw.productName);

    if (raw.accountName && !account) warnings.push(`لم يُطابَق الحساب «${raw.accountName}»`);
    if (raw.categoryName && !category) warnings.push(`لم يُطابَق التصنيف «${raw.categoryName}»`);
    if (raw.contactName && !contact) warnings.push(`لم تُطابَق جهة الاتصال «${raw.contactName}»`);
    if (raw.productName && !product) warnings.push(`لم يُطابَق المنتج «${raw.productName}»`);

    let categoryItemId: string | null = null;
    let categoryItemName: string | null = null;
    if (raw.itemName && category) {
      const item = resolveByName(category.items, raw.itemName);
      if (item) {
        categoryItemId = item.id;
        categoryItemName = item.name;
      } else {
        warnings.push(`لم يُطابَق البند الفرعي «${raw.itemName}»`);
      }
    } else if (raw.itemName && !category) {
      warnings.push('لا يمكن مطابقة البند الفرعي دون تصنيف');
    }

    if (!account) missingFields.push('account');
    if (!category) missingFields.push('category');

    const amount = raw.amount;
    if (!isPositiveDecimal(amount)) {
      if (amount) warnings.push('المبلغ غير صالح');
      if (!missingFields.includes('amount')) missingFields.push('amount');
    }

    const needsContact = raw.kind !== null && CREDIT_CONTACT_KINDS.has(raw.kind);
    if (needsContact && !contact) {
      missingFields.push('contact');
      warnings.push('هذا النوع يتطلّب جهة اتصال');
    }

    if (product && !raw.quantity) {
      missingFields.push('quantity');
      warnings.push('ربط المنتج يتطلّب كمية');
    }

    const uniqueMissing = [...new Set(missingFields)];
    const confirmable =
      raw.kind !== null &&
      isPositiveDecimal(amount) &&
      raw.currencyCode !== null &&
      account !== null &&
      category !== null &&
      (!needsContact || contact !== null) &&
      !(product && !raw.quantity);

    const card: VoiceCard = {
      cardId: '',
      kind: raw.kind,
      kindLabelAr: raw.kind ? (VOICE_KIND_LABEL_AR[raw.kind] ?? raw.kind) : null,
      amount,
      currencyCode: raw.currencyCode,
      businessDate: raw.businessDate,
      financialAccountId: account?.id ?? null,
      accountName: account?.name ?? raw.accountName ?? null,
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? raw.categoryName ?? null,
      categoryItemId,
      categoryItemName,
      contactId: contact?.id ?? null,
      contactName: contact?.name ?? raw.contactName ?? null,
      productId: product?.id ?? null,
      productName: product?.name ?? raw.productName ?? null,
      quantity: raw.quantity,
      description: raw.description,
      language: raw.language,
      confidence: raw.confidence,
      missingFields: uniqueMissing,
      warnings,
      confirmable,
    };
    card.cardId = this.buildCardId(card);
    return card;
  }

  private buildCardId(card: VoiceCard): string {
    const parts = [
      card.kind ?? '',
      card.amount ?? '',
      card.currencyCode ?? '',
      card.businessDate ?? '',
      card.financialAccountId ?? '',
      card.categoryId ?? '',
      card.categoryItemId ?? '',
      card.contactId ?? '',
      card.productId ?? '',
      card.quantity ?? '',
      card.description ?? '',
    ];
    return createHash('sha256').update(parts.join('\u0001')).digest('hex');
  }
}
