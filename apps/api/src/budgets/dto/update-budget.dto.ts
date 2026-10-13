import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import {
  BUDGET_LIMIT_TYPES,
  BUDGET_PERCENT_BASES,
} from '../budgets.constants.js';

/**
 * Partial update. Only the fields listed in `API_CONTRACTS.md` §10.1 (`name`,
 * the limit trio, `carryForwardEnabled`, and the scope links) are mutable;
 * `flow` and `periodType` stay fixed after creation so historical periods keep
 * their meaning.
 */
export class UpdateBudgetDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  name?: string;

  @IsOptional()
  @IsEnum(BUDGET_LIMIT_TYPES)
  limitType?: (typeof BUDGET_LIMIT_TYPES)[number];

  @IsOptional()
  @IsDecimal()
  fixedAmount?: string;

  @IsOptional()
  @IsDecimal()
  percentValue?: string;

  @IsOptional()
  @IsEnum(BUDGET_PERCENT_BASES)
  percentBasis?: (typeof BUDGET_PERCENT_BASES)[number];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  categoryItemId?: string;

  @IsOptional()
  @IsBoolean()
  carryForwardEnabled?: boolean;
}