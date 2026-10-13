import { IsDecimal, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DRAFT_KINDS, type DraftKind } from '../../transactions/transactions.constants.js';

/**
 * بطاقة مراجعة الصوت كما تُرسل للتأكيد. لا `source` ولا `status` من العميل؛
 * المصدر يُثبَّت `VOICE` في الخدمة، والحالة تبقى `DRAFT`.
 */
export class ConfirmVoiceCardDto {
  @IsIn(DRAFT_KINDS)
  kind!: DraftKind;

  @IsDecimal()
  amount!: string;

  @IsString()
  currencyCode!: string;

  @IsUUID()
  financialAccountId!: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  categoryItemId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsDecimal()
  quantity?: string;

  @IsOptional()
  @IsDecimal()
  exchangeRate?: string;

  @IsOptional()
  @IsString()
  businessDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
