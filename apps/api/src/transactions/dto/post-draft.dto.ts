import { IsOptional, IsString, Matches } from 'class-validator';

export class PostDraftDto {
  /**
   * Optional due date for a credit draft that opens a debt. `Debt.dueDate`
   * exists, but the draft itself has no `dueDate` column, so it is supplied at
   * post time and applied only to `SALE_CREDIT`/`PURCHASE_CREDIT`.
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;
}
