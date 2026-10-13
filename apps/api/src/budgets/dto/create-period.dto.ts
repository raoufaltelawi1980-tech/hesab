import { IsDecimal, IsEnum, IsOptional, IsString } from 'class-validator';
import { BUDGET_PERIOD_TYPES } from '../budgets.constants.js';

/**
 * `periodStart` / `periodEnd` arrive as calendar dates. They are stored in
 * `BudgetPeriod.periodStart|periodEnd`, which are `@db.Date` columns, so the
 * service normalises them to UTC midnight and rejects an inverted window.
 */
export class CreatePeriodDto {
  @IsString()
  periodStart!: string;

  @IsString()
  periodEnd!: string;

  /** Defaults to `CUSTOM`, matching the "فترة مخصصة" route in §10.1. */
  @IsOptional()
  @IsEnum(BUDGET_PERIOD_TYPES)
  periodType?: (typeof BUDGET_PERIOD_TYPES)[number];

  /** Overrides the limit derived from the budget when the amount should differ. */
  @IsOptional()
  @IsDecimal()
  effectiveLimit?: string;
}