import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PRODUCT_KINDS } from '../inventory.constants.js';

export class CreateProductDto {
  @IsIn(PRODUCT_KINDS)
  kind!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string | null;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsString()
  unitPrice!: string;

  @IsOptional()
  @IsString()
  costPrice?: string | null;

  @IsOptional()
  @IsUUID()
  currencyId?: string | null;

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  @IsOptional()
  @IsUUID()
  defaultWarehouseId?: string | null;
}
