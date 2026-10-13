import {
  IsDecimal,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { CONTACT_KINDS } from '../contacts.constants.js';

/**
 * Decorators mirror `API_CONTRACTS.md` section 13.1. The authoritative checks
 * live in `ContactsService`, because `main.ts` registers no global
 * `ValidationPipe`.
 */
export class CreateContactDto {
  @IsIn(CONTACT_KINDS)
  kind!: string;

  @IsString()
  @Length(1, 200)
  name!: string;

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
  @IsUUID()
  currencyId?: string | null;

  @IsOptional()
  @IsDecimal()
  creditLimit?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}