import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const countries = [
  { iso2: 'US', iso3: 'USA', nameEn: 'United States', nameAr: 'الولايات المتحدة الأمريكية' },
  { iso2: 'GB', iso3: 'GBR', nameEn: 'United Kingdom', nameAr: 'المملكة المتحدة' },
  { iso2: 'AE', iso3: 'ARE', nameEn: 'United Arab Emirates', nameAr: 'الإمارات العربية المتحدة' },
  { iso2: 'SA', iso3: 'SAU', nameEn: 'Saudi Arabia', nameAr: 'المملكة العربية السعودية' },
  { iso2: 'QA', iso3: 'QAT', nameEn: 'Qatar', nameAr: 'قطر' },
  { iso2: 'EG', iso3: 'EGY', nameEn: 'Egypt', nameAr: 'مصر' },
  { iso2: 'JO', iso3: 'JOR', nameEn: 'Jordan', nameAr: 'الأردن' },
  { iso2: 'TR', iso3: 'TUR', nameEn: 'Turkey', nameAr: 'تركيا' },
  { iso2: 'FR', iso3: 'FRA', nameEn: 'France', nameAr: 'فرنسا' },
  { iso2: 'DE', iso3: 'DEU', nameEn: 'Germany', nameAr: 'ألمانيا' },
];

const currencies = [
  { code: 'USD', nameEn: 'US Dollar', nameAr: 'دولار أمريكي', minorUnit: 2 },
  { code: 'EUR', nameEn: 'Euro', nameAr: 'يورو', minorUnit: 2 },
  { code: 'GBP', nameEn: 'Pound Sterling', nameAr: 'جنيه إسترليني', minorUnit: 2 },
  { code: 'QAR', nameEn: 'Qatari Rial', nameAr: 'ريال قطري', minorUnit: 2 },
  { code: 'SAR', nameEn: 'Saudi Riyal', nameAr: 'ريال سعودي', minorUnit: 2 },
  { code: 'AED', nameEn: 'UAE Dirham', nameAr: 'درهم إماراتي', minorUnit: 2 },
  { code: 'EGP', nameEn: 'Egyptian Pound', nameAr: 'جنيه مصري', minorUnit: 2 },
  { code: 'JOD', nameEn: 'Jordanian Dinar', nameAr: 'دينار أردني', minorUnit: 3 },
  { code: 'TRY', nameEn: 'Turkish Lira', nameAr: 'ليرة تركية', minorUnit: 2 },
];

async function main() {
  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: { nameAr: c.nameAr, nameEn: c.nameEn, minorUnit: c.minorUnit, isActive: true },
      create: { code: c.code, nameAr: c.nameAr, nameEn: c.nameEn, minorUnit: c.minorUnit, isActive: true },
    });
  }

  const usd = await prisma.currency.findUnique({ where: { code: 'USD' } });
  const eur = await prisma.currency.findUnique({ where: { code: 'EUR' } });
  const gbp = await prisma.currency.findUnique({ where: { code: 'GBP' } });
  const qar = await prisma.currency.findUnique({ where: { code: 'QAR' } });
  const sar = await prisma.currency.findUnique({ where: { code: 'SAR' } });
  const aed = await prisma.currency.findUnique({ where: { code: 'AED' } });
  const egp = await prisma.currency.findUnique({ where: { code: 'EGP' } });
  const jod = await prisma.currency.findUnique({ where: { code: 'JOD' } });
  const tryc = await prisma.currency.findUnique({ where: { code: 'TRY' } });

  for (const co of countries) {
    const def = co.iso2 === 'US' ? usd?.id
      : co.iso2 === 'GB' ? gbp?.id
      : co.iso2 === 'AE' ? aed?.id
      : co.iso2 === 'SA' ? sar?.id
      : co.iso2 === 'QA' ? qar?.id
      : co.iso2 === 'EG' ? egp?.id
      : co.iso2 === 'JO' ? jod?.id
      : co.iso2 === 'TR' ? tryc?.id
      : co.iso2 === 'FR' || co.iso2 === 'DE' ? eur?.id
      : undefined;

    await prisma.country.upsert({
      where: { iso2: co.iso2 },
      update: { iso3: co.iso3, nameEn: co.nameEn, nameAr: co.nameAr, isActive: true, ...(def ? { defaultCurrencyId: def } : {}) },
      create: { iso2: co.iso2, iso3: co.iso3, nameEn: co.nameEn, nameAr: co.nameAr, isActive: true, ...(def ? { defaultCurrencyId: def } : {}) },
    });
  }
}

main().then(() => prisma.$disconnect()).catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
