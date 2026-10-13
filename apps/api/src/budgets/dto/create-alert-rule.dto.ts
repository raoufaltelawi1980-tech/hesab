import { IsBoolean, IsDecimal, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { ALERT_THRESHOLD_TYPES, ALERT_TRIGGERS } from '../budgets.constants.js';

/**
 * Mirrors `API_CONTRACTS.md` §10.2. `BudgetsService.validateThreshold` owns the
 * exclusivity enforcement, for the same reason as the budget limit trio.
 */
export class CreateAlertRuleDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsEnum(ALERT_THRESHOLD_TYPES)
  thresholdType!: (typeof ALERT_THRESHOLD_TYPES)[number];

  @IsOptional()
  @IsDecimal()
  numericThreshold?: string;

  @IsOptional()
  @IsDecimal()
  percentThreshold?: string;

  @IsOptional()
  @IsEnum(ALERT_TRIGGERS)
  triggerOn?: (typeof ALERT_TRIGGERS)[number];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}