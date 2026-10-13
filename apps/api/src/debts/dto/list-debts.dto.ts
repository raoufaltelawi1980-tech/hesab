import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { DEBT_DIRECTIONS, DEBT_STATUSES } from '../debts.constants.js';

export class ListDebtsDto {
  @IsOptional()
  @IsIn(DEBT_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(DEBT_DIRECTIONS)
  direction?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;
}
