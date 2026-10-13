import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsUUID()
  currencyId?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
