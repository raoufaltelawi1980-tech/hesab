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
  BUDGET_FLOWS,
  BUDGET_LIMIT_TYPES,
  BUDGET_PERCENT_BASES,
  BUDGET_PERIOD_TYPES,
} from '../budgets.constants.js';

/**
 * Decorators mirror `API_CONTRACTS.md` §10.1. The authoritative enforcement
 * lives in `BudgetsService.validateLimit`, because `main.ts` registers no
 * global `ValidationPipe`, and the exclusivity rules cannot be expressed as
 * single-field decorators anyway.
 */
export class CreateBudgetDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsEnum(BUDGET_FLOWS)
  flow!: (typeof BUDGET_FLOWS)[number];

  @IsEnum(BUDGET_PERIOD_TYPES)
  periodType!: (typeof BUDGET_PERIOD_TYPES)[number];

  @IsEnum(BUDGET_LIMIT_TYPES)
  limitType!: (typeof BUDGET_LIMIT_TYPES)[number];

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
  currencyId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  categoryItemId?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsBoolean()
  carryForwardEnabled?: boolean;
}