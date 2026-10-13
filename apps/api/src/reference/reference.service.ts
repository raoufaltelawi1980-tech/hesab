import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** دولة من المرجع العام: الحقول الفعلية في نموذج `Country`. */
export type ReferenceCountryView = {
  id: string;
  iso2: string;
  iso3: string;
  nameEn: string;
  nameAr: string;
  defaultCurrencyId: string | null;
};

/** عملة من المرجع العام: الحقول الفعلية في نموذج `Currency`. */
export type ReferenceCurrencyView = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  minorUnit: number;
};

/**
 * المرجع العام للدول والعملات (قسم 6.1) — للقراءة فقط، بلا تعديل.
 * المصدر هو `Country`/`Currency` الفعليان، ولا يُزرع من هنا. التغطية محدودة
 * ببيانات الزرع الحالية (10 دول · 9 عملات) ولا يُدّعى دعم كل ISO 3166/4217.
 */
@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  /** الدول النشطة فقط، بترتيب ثابت (`iso2` تصاعديًا). */
  async listCountries(): Promise<ReferenceCountryView[]> {
    return this.prisma.country.findMany({
      where: { isActive: true },
      orderBy: { iso2: 'asc' },
      select: {
        id: true,
        iso2: true,
        iso3: true,
        nameEn: true,
        nameAr: true,
        defaultCurrencyId: true,
      },
    });
  }

  /** العملات النشطة فقط، بترتيب ثابت (`code` تصاعديًا) مع `minorUnit`. */
  async listCurrencies(): Promise<ReferenceCurrencyView[]> {
    return this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        nameEn: true,
        nameAr: true,
        minorUnit: true,
      },
    });
  }
}
