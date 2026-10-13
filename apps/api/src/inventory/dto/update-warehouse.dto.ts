import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsUUID()
  currencyId?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
