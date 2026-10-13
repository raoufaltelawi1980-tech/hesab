import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsString()
  unitPrice?: string;

  @IsOptional()
  @IsString()
  costPrice?: string | null;

  @IsOptional()
  @IsUUID()
  currencyId?: string | null;

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  /** Empty string clears the default warehouse. */
  @IsOptional()
  @IsUUID()
  defaultWarehouseId?: string | null;
}
