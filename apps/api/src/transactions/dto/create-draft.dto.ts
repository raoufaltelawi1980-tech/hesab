import { IsDecimal, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { DRAFT_KINDS, type DraftKind } from '../transactions.constants.js';

export class CreateDraftDto {
  @IsIn(DRAFT_KINDS)
  type!: DraftKind;

  @IsUUID()
  financialAccountId!: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  categoryItemId?: string;

  /** Required for the credit kinds (`SALE_CREDIT` · `PURCHASE_CREDIT`). */
  @IsOptional()
  @IsUUID()
  contactId?: string;

  /** Optional link to a stocked product (TASK-025); sale/purchase kinds only. */
  @IsOptional()
  @IsUUID()
  productId?: string;

  /** Mandatory with `productId`, strictly positive. */
  @IsOptional()
  @IsDecimal()
  quantity?: string;

  @IsDecimal()
  amount!: string;

  @IsString()
  currencyCode!: string;

  @IsOptional()
  @IsDecimal()
  exchangeRate?: string;

  @IsOptional()
  @IsDecimal()
  amountBase?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  businessDate?: string;

  /** Optional transfer target account (TRANSFER only). */
  @IsOptional()
  @IsUUID()
  counterpartyAccountId?: string;
}
