import { IsDecimal, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateDraftDto {
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  categoryItemId?: string;

  /** Empty string clears the link; refused for the credit kinds. */
  @IsOptional()
  @IsUUID()
  contactId?: string;

  /** Empty string clears the product link. */
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsDecimal()
  quantity?: string;

  @IsOptional()
  @IsDecimal()
  amount?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

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

  @IsOptional()
  @IsUUID()
  counterpartyAccountId?: string;
}