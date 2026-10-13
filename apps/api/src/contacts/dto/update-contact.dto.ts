import { IsDecimal, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/**
 * Partial update. `API_CONTRACTS.md` section 13.1 lists `name`, `phone` and
 * `creditLimit`; `email`, `taxNumber` and `notes` are included as the same
 * descriptive fields. `kind` and `currencyId` stay fixed after creation, so a
 * contact never changes its role or its settlement currency.
 */
export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  taxNumber?: string | null;

  @IsOptional()
  @IsDecimal()
  creditLimit?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}