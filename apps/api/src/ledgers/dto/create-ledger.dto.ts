/**
 * نوع الدفتر مطابق لـ`enum LedgerType` الفعلي في المخطّط: `HOUSEHOLD` · `BUSINESS`.
 * لا وجود لـ`FAMILY`؛ النوع ثابت بعد الإنشاء (قسم 7).
 */
export type LedgerTypeValue = 'HOUSEHOLD' | 'BUSINESS';

export class CreateLedgerDto {
  name!: string;
  type!: LedgerTypeValue;
  countryId!: string;
  baseCurrencyId!: string;
  timezone?: string;
  budgetsEnabled?: boolean;
}
