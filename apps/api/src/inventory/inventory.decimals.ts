import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** المال لا يمرّ عبر `Number`: `Decimal(20,4)` يحفظ دقته كما هي. */
export function money(value: Prisma.Decimal | null | undefined): string {
  return value === null || value === undefined ? '0.0000' : value.toFixed(4);
}

/** الكمية `Decimal(18,6)` تُعرض بست منازل. */
export function quantityText(value: Prisma.Decimal | null | undefined): string {
  return value === null || value === undefined ? '0.000000' : value.toFixed(6);
}

export function parseDecimal(raw: unknown, field: string): Prisma.Decimal {
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    throw new BadRequestException(`${field} مطلوب`);
  }
  const text = String(raw).trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new BadRequestException(`${field} ليس رقمًا صالحًا`);
  return new Prisma.Decimal(text);
}

export function positiveDecimal(raw: unknown, field: string): Prisma.Decimal {
  const value = parseDecimal(raw, field);
  if (value.lte(0)) throw new BadRequestException(`${field} يجب أن يكون أكبر من صفر`);
  return value;
}

export function nonNegativeDecimal(raw: unknown, field: string): Prisma.Decimal {
  const value = parseDecimal(raw, field);
  if (value.lt(0)) throw new BadRequestException(`${field} يجب أن يكون صفرًا أو أكبر`);
  return value;
}

/** تقريب تكلفة الوحدة إلى مقياس العمود `Decimal(20,4)`. */
export function round4(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}
