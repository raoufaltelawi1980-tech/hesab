import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, Permission } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLedgerDto } from './dto/create-ledger.dto.js';
import { UpdateLedgerSettingsDto } from './dto/update-ledger-settings.dto.js';

/** المالك يملك كل مفردات `Permission`؛ المصدر الوحيد للصلاحيات هو الـenum. */
const OWNER_PERMISSIONS: Permission[] = Object.values(Permission);

type LedgerRole = 'OWNER' | 'MEMBER';

@Injectable()
export class LedgersService {
  constructor(private readonly prisma: PrismaService) {}

  private isUuid(v: string): boolean {
    try {
      return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
    } catch {
      return false;
    }
  }

  /** الصلاحيات الحيّة فقط: لا نُعيد صلاحية مُبطَلة. */
  private livePermissions(
    rows: { permission: Permission; revokedAt: Date | null }[],
  ): Permission[] {
    return rows.filter((row) => !row.revokedAt).map((row) => row.permission);
  }

  /**
   * يحسم وصول المستخدم إلى دفتر: المالك دائمًا، أو عضو **نشط** غير مؤرشف.
   * العضوية الموقوفة/المحذوفة/غير الموجودة تُرجع `null` فلا يُكشف الدفتر.
   */
  private async resolveAccess(
    ledger: { id: string; ownerId: string },
    userId: string,
  ): Promise<{ role: LedgerRole; permissions: Permission[] } | null> {
    if (ledger.ownerId === userId) {
      return { role: 'OWNER', permissions: OWNER_PERMISSIONS };
    }
    const membership = await this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId: ledger.id, userId } },
      include: { permissions: true },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE || membership.archivedAt) {
      return null;
    }
    return { role: 'MEMBER', permissions: this.livePermissions(membership.permissions) };
  }

  /**
   * بوابة القراءة التفصيلية (مثل `accounts`): المالك أو عضو **نشط** يملك صلاحية
   * عرض/إنشاء قيود. الصلاحية تُفحص قبل أي كشف بيانات.
   */
  private async canAccessLedger(actorId: string, ledger: { id: string; ownerId: string }): Promise<boolean> {
    if (ledger.ownerId === actorId) return true;
    const membership = await this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId: ledger.id, userId: actorId } },
      include: { permissions: true },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE || membership.archivedAt) return false;
    return this.livePermissions(membership.permissions).some(
      (permission) =>
        permission === Permission.LEDGER_VIEW ||
        permission === Permission.ENTRY_VIEW ||
        permission === Permission.ENTRY_CREATE,
    );
  }

  /**
   * قائمة الدفاتر: ما يملكه المستخدم + ما هو عضو **نشط** فيه، مع `role`
   * والصلاحيات الفعلية. العضويات المعلقة/الموقوفة/المحذوفة لا تظهر.
   */
  async list(userId: string) {
    const [owned, memberships] = await Promise.all([
      this.prisma.ledger.findMany({
        where: { ownerId: userId },
        include: { baseCurrency: { select: { id: true, code: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ledgerMember.findMany({
        where: { userId, status: MembershipStatus.ACTIVE, archivedAt: null },
        include: {
          ledger: { include: { baseCurrency: { select: { id: true, code: true } } } },
          permissions: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const ownedSummaries = owned.map((ledger) => ({
      ...ledger,
      role: 'OWNER' as const,
      permissions: OWNER_PERMISSIONS,
    }));

    const memberSummaries = memberships.map((membership) => ({
      ...membership.ledger,
      role: 'MEMBER' as const,
      permissions: this.livePermissions(membership.permissions),
    }));

    return [...ownedSummaries, ...memberSummaries];
  }

  /**
   * تفاصيل الدفتر: المالك أو العضو النشط. أي وصول مرفوض يعود `404` لا `403`
   * حتى لا نكشف وجود دفتر لا يملك المستخدم حق الوصول إليه.
   */
  async get(id: string, userId: string) {
    if (!this.isUuid(id)) throw new NotFoundException('Ledger not found');
    const ledger = await this.prisma.ledger.findUnique({
      where: { id },
      include: { baseCurrency: { select: { id: true, code: true } } },
    });
    if (!ledger) throw new NotFoundException('Ledger not found');
    const access = await this.resolveAccess(ledger, userId);
    if (!access) throw new NotFoundException('Ledger not found');
    return { ...ledger, role: access.role, permissions: access.permissions };
  }

  async listAccounts(id: string, ownerId: string) {
    if (!this.isUuid(id)) throw new NotFoundException('Ledger not found');
    const l = await this.prisma.ledger.findUnique({ where: { id } });
    if (!l) throw new NotFoundException('Ledger not found');
    if (!(await this.canAccessLedger(ownerId, l))) throw new ForbiddenException('لا تملك صلاحية تنفيذ هذه العملية');
    return this.prisma.financialAccount.findMany({
      where: { ledgerId: id, archivedAt: null },
      include: { currency: { select: { id: true, code: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(dto: CreateLedgerDto, ownerId: string) {
    // النوع مطابق لـ`enum LedgerType` الفعلي (HOUSEHOLD/BUSINESS) ولا `FAMILY`؛
    // لا يُقبل أي نوع آخر، ولا يمكن تخمينه من الواجهة (قسم 7).
    if (dto.type !== 'HOUSEHOLD' && dto.type !== 'BUSINESS') {
      throw new BadRequestException('نوع الدفتر غير صالح');
    }
    if (!this.isUuid(dto.countryId)) throw new BadRequestException('الدولة غير صالحة');
    if (!this.isUuid(dto.baseCurrencyId)) throw new BadRequestException('العملة غير صالحة');

    const [country, currency] = await this.prisma.$transaction([
      this.prisma.country.findUnique({ where: { id: dto.countryId } }),
      this.prisma.currency.findUnique({ where: { id: dto.baseCurrencyId } }),
    ]);
    if (!country || !country.isActive) throw new BadRequestException('الدولة غير صالحة');
    if (!currency || !currency.isActive) throw new BadRequestException('العملة غير صالحة');

    return this.prisma.$transaction(async (tx) => {
      const ledger = await tx.ledger.create({
        data: {
          name: dto.name,
          type: dto.type,
          ownerId,
          countryId: dto.countryId,
          baseCurrencyId: dto.baseCurrencyId,
          timezone: dto.timezone ?? 'UTC',
          budgetsEnabled: dto.budgetsEnabled ?? false,
        },
      });
      const names = ['نقدي', 'حساب بنكي', 'محفظة إلكترونية'];
      for (let i = 0; i < names.length; i++) {
        await tx.financialAccount.create({
          data: {
            ledgerId: ledger.id,
            name: names[i],
            type: 'CASH',
            currencyId: currency.id,
          },
        });
      }

      if (ledger.type === 'HOUSEHOLD') {
        const home = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'المنزل', systemKey: 'FAMILY_HOME' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: home.id, name: 'إيجار أو قسط منزل', systemKey: 'FAMILY_HOME_RENT' },
          { categoryId: home.id, name: 'كهرباء', systemKey: 'FAMILY_HOME_ELECTRIC' },
          { categoryId: home.id, name: 'ماء', systemKey: 'FAMILY_HOME_WATER' },
          { categoryId: home.id, name: 'غاز', systemKey: 'FAMILY_HOME_GAS' },
          { categoryId: home.id, name: 'إنترنت واتصالات', systemKey: 'FAMILY_HOME_INTERNET' },
          { categoryId: home.id, name: 'أثاث', systemKey: 'FAMILY_HOME_FURNITURE' },
          { categoryId: home.id, name: 'أدوات منزلية', systemKey: 'FAMILY_HOME_TOOLS' },
          { categoryId: home.id, name: 'تنظيف', systemKey: 'FAMILY_HOME_CLEANING' },
          { categoryId: home.id, name: 'صيانة منزلية', systemKey: 'FAMILY_HOME_MAINT' },
        ] });
        const food = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'الطعام والشراب', systemKey: 'FAMILY_FOOD' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: food.id, name: 'مشتريات منزلية', systemKey: 'FAMILY_FOOD_GROCERIES' },
          { categoryId: food.id, name: 'بقالة', systemKey: 'FAMILY_FOOD_BAKERY' },
          { categoryId: food.id, name: 'خضار وفواكه', systemKey: 'FAMILY_FOOD_VEG' },
          { categoryId: food.id, name: 'لحوم ودواجن', systemKey: 'FAMILY_FOOD_MEAT' },
          { categoryId: food.id, name: 'أسماك', systemKey: 'FAMILY_FOOD_FISH' },
          { categoryId: food.id, name: 'مخبوزات', systemKey: 'FAMILY_FOOD_BAKED' },
          { categoryId: food.id, name: 'مطاعم', systemKey: 'FAMILY_FOOD_RESTAURANTS' },
          { categoryId: food.id, name: 'مشروبات', systemKey: 'FAMILY_FOOD_DRINKS' },
        ] });
        const car = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'السيارة والمواصلات', systemKey: 'FAMILY_CAR' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: car.id, name: 'بنزين', systemKey: 'FAMILY_CAR_FUEL' },
          { categoryId: car.id, name: 'ديزل', systemKey: 'FAMILY_CAR_DIESEL' },
          { categoryId: car.id, name: 'صيانة', systemKey: 'FAMILY_CAR_MAINT' },
          { categoryId: car.id, name: 'إصلاحات', systemKey: 'FAMILY_CAR_REPAIR' },
          { categoryId: car.id, name: 'إطارات', systemKey: 'FAMILY_CAR_TIRES' },
          { categoryId: car.id, name: 'تأمين', systemKey: 'FAMILY_CAR_INS' },
          { categoryId: car.id, name: 'تجديد ملكية', systemKey: 'FAMILY_CAR_REG' },
          { categoryId: car.id, name: 'غسيل', systemKey: 'FAMILY_CAR_WASH' },
          { categoryId: car.id, name: 'مواقف', systemKey: 'FAMILY_CAR_PARK' },
          { categoryId: car.id, name: 'مواصلات عامة', systemKey: 'FAMILY_CAR_TRANSIT' },
          { categoryId: car.id, name: 'سيارات أجرة', systemKey: 'FAMILY_CAR_TAXI' },
        ] });
        const health = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'الصحة', systemKey: 'FAMILY_HEALTH' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: health.id, name: 'طبيب', systemKey: 'FAMILY_HEALTH_DOCTOR' },
          { categoryId: health.id, name: 'مستشفى', systemKey: 'FAMILY_HEALTH_HOSPITAL' },
          { categoryId: health.id, name: 'صيدلية وأدوية', systemKey: 'FAMILY_HEALTH_PHARMACY' },
          { categoryId: health.id, name: 'تحاليل', systemKey: 'FAMILY_HEALTH_LABS' },
          { categoryId: health.id, name: 'أسنان', systemKey: 'FAMILY_HEALTH_DENTAL' },
          { categoryId: health.id, name: 'نظارات', systemKey: 'FAMILY_HEALTH_EYES' },
          { categoryId: health.id, name: 'تأمين صحي', systemKey: 'FAMILY_HEALTH_INS' },
        ] });
        const familyCat = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'الأسرة والأبناء', systemKey: 'FAMILY_CHILDREN' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: familyCat.id, name: 'مدرسة وتعليم', systemKey: 'FAMILY_CHILDREN_SCHOOL' },
          { categoryId: familyCat.id, name: 'كتب وقرطاسية', systemKey: 'FAMILY_CHILDREN_BOOKS' },
          { categoryId: familyCat.id, name: 'ملابس', systemKey: 'FAMILY_CHILDREN_CLOTHES' },
          { categoryId: familyCat.id, name: 'ألعاب', systemKey: 'FAMILY_CHILDREN_TOYS' },
          { categoryId: familyCat.id, name: 'حضانة', systemKey: 'FAMILY_CHILDREN_KINDER' },
          { categoryId: familyCat.id, name: 'أنشطة', systemKey: 'FAMILY_CHILDREN_ACTIVITIES' },
          { categoryId: familyCat.id, name: 'مصروف شخصي', systemKey: 'FAMILY_CHILDREN_ALLOWANCE' },
          { categoryId: familyCat.id, name: 'هدايا', systemKey: 'FAMILY_CHILDREN_GIFTS' },
        ] });
        const personal = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'العناية الشخصية', systemKey: 'FAMILY_PERSONAL' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: personal.id, name: 'حلاق رجالي', systemKey: 'FAMILY_PERSONAL_MALE' },
          { categoryId: personal.id, name: 'كوافيرة نسائية', systemKey: 'FAMILY_PERSONAL_FEMALE' },
          { categoryId: personal.id, name: 'مستحضرات شخصية', systemKey: 'FAMILY_PERSONAL_COSMETICS' },
          { categoryId: personal.id, name: 'ملابس وأحذية', systemKey: 'FAMILY_PERSONAL_CLOTHES' },
          { categoryId: personal.id, name: 'عناية بالبشرة', systemKey: 'FAMILY_PERSONAL_SKIN' },
          { categoryId: personal.id, name: 'عناية بالشعر', systemKey: 'FAMILY_PERSONAL_HAIR' },
        ] });
        const leisure = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'الترفيه والسفر', systemKey: 'FAMILY_LEISURE' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: leisure.id, name: 'رحلات', systemKey: 'FAMILY_LEISURE_TRIPS' },
          { categoryId: leisure.id, name: 'فنادق', systemKey: 'FAMILY_LEISURE_HOTELS' },
          { categoryId: leisure.id, name: 'تذاكر', systemKey: 'FAMILY_LEISURE_TICKETS' },
          { categoryId: leisure.id, name: 'ألعاب وترفيه', systemKey: 'FAMILY_LEISURE_FUN' },
          { categoryId: leisure.id, name: 'اشتراكات رقمية', systemKey: 'FAMILY_LEISURE_SUBS' },
          { categoryId: leisure.id, name: 'مناسبات', systemKey: 'FAMILY_LEISURE_EVENTS' },
        ] });
        const obligations = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'الالتزامات والمال', systemKey: 'FAMILY_OBLIGATIONS' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: obligations.id, name: 'أقساط', systemKey: 'FAMILY_OBLIGATIONS_INSTALLMENTS' },
          { categoryId: obligations.id, name: 'قروض', systemKey: 'FAMILY_OBLIGATIONS_LOANS' },
          { categoryId: obligations.id, name: 'تحويلات', systemKey: 'FAMILY_OBLIGATIONS_TRANSFERS' },
          { categoryId: obligations.id, name: 'رسوم بنكية', systemKey: 'FAMILY_OBLIGATIONS_BANK_FEES' },
          { categoryId: obligations.id, name: 'تبرعات', systemKey: 'FAMILY_OBLIGATIONS_DONATIONS' },
          { categoryId: obligations.id, name: 'زكاة', systemKey: 'FAMILY_OBLIGATIONS_ZAKAT' },
          { categoryId: obligations.id, name: 'غرامات', systemKey: 'FAMILY_OBLIGATIONS_FINES' },
          { categoryId: obligations.id, name: 'مصاريف أخرى', systemKey: 'FAMILY_OBLIGATIONS_OTHER' },
        ] });
        const income = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'الدخل', systemKey: 'FAMILY_INCOME' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: income.id, name: 'راتب', systemKey: 'FAMILY_INCOME_SALARY' },
          { categoryId: income.id, name: 'عمل إضافي', systemKey: 'FAMILY_INCOME_EXTRA' },
          { categoryId: income.id, name: 'دخل استثماري', systemKey: 'FAMILY_INCOME_INVEST' },
          { categoryId: income.id, name: 'إيجار مستلم', systemKey: 'FAMILY_INCOME_RENT' },
          { categoryId: income.id, name: 'هدية أو تحويل مستلم', systemKey: 'FAMILY_INCOME_GIFT' },
          { categoryId: income.id, name: 'دخل آخر', systemKey: 'FAMILY_INCOME_OTHER' },
        ] });
      } else if (ledger.type === 'BUSINESS') {
        const sales = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'المبيعات', systemKey: 'BUSINESS_SALES' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: sales.id, name: 'مبيعات نقدية', systemKey: 'BUSINESS_SALES_CASH' },
          { categoryId: sales.id, name: 'مبيعات آجلة', systemKey: 'BUSINESS_SALES_CREDIT' },
          { categoryId: sales.id, name: 'خدمات', systemKey: 'BUSINESS_SALES_SERVICES' },
          { categoryId: sales.id, name: 'اشتراكات', systemKey: 'BUSINESS_SALES_SUBS' },
          { categoryId: sales.id, name: 'عمولات', systemKey: 'BUSINESS_SALES_COMM' },
          { categoryId: sales.id, name: 'مرتجعات مبيعات', systemKey: 'BUSINESS_SALES_RETURNS' },
          { categoryId: sales.id, name: 'خصومات مبيعات', systemKey: 'BUSINESS_SALES_DISCOUNTS' },
        ] });
        const purchases = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'المشتريات', systemKey: 'BUSINESS_PURCHASES' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: purchases.id, name: 'بضاعة', systemKey: 'BUSINESS_PURCHASES_GOODS' },
          { categoryId: purchases.id, name: 'مواد خام', systemKey: 'BUSINESS_PURCHASES_RAW' },
          { categoryId: purchases.id, name: 'مستلزمات تشغيل', systemKey: 'BUSINESS_PURCHASES_SUPPLIES' },
          { categoryId: purchases.id, name: 'مشتريات نقدية', systemKey: 'BUSINESS_PURCHASES_CASH' },
          { categoryId: purchases.id, name: 'مشتريات آجلة', systemKey: 'BUSINESS_PURCHASES_CREDIT' },
          { categoryId: purchases.id, name: 'مرتجعات مشتريات', systemKey: 'BUSINESS_PURCHASES_RETURNS' },
          { categoryId: purchases.id, name: 'خصومات مشتريات', systemKey: 'BUSINESS_PURCHASES_DISCOUNTS' },
        ] });
        const ops = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'المصاريف التشغيلية', systemKey: 'BUSINESS_OPS' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: ops.id, name: 'إيجار', systemKey: 'BUSINESS_OPS_RENT' },
          { categoryId: ops.id, name: 'كهرباء وماء', systemKey: 'BUSINESS_OPS_UTILITIES' },
          { categoryId: ops.id, name: 'إنترنت واتصالات', systemKey: 'BUSINESS_OPS_INTERNET' },
          { categoryId: ops.id, name: 'صيانة', systemKey: 'BUSINESS_OPS_MAINT' },
          { categoryId: ops.id, name: 'أدوات ومستلزمات', systemKey: 'BUSINESS_OPS_TOOLS' },
          { categoryId: ops.id, name: 'برامج وخدمات إلكترونية', systemKey: 'BUSINESS_OPS_SOFTWARE' },
          { categoryId: ops.id, name: 'نقل وتوصيل', systemKey: 'BUSINESS_OPS_DELIVERY' },
          { categoryId: ops.id, name: 'وقود', systemKey: 'BUSINESS_OPS_FUEL' },
          { categoryId: ops.id, name: 'تأمين', systemKey: 'BUSINESS_OPS_INS' },
          { categoryId: ops.id, name: 'رسوم بنكية', systemKey: 'BUSINESS_OPS_BANK_FEES' },
        ] });
        const staff = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'العاملون', systemKey: 'BUSINESS_STAFF' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: staff.id, name: 'رواتب', systemKey: 'BUSINESS_STAFF_SALARIES' },
          { categoryId: staff.id, name: 'أجور يومية', systemKey: 'BUSINESS_STAFF_DAILY' },
          { categoryId: staff.id, name: 'عمولات', systemKey: 'BUSINESS_STAFF_COMM' },
          { categoryId: staff.id, name: 'مكافآت', systemKey: 'BUSINESS_STAFF_BONUS' },
          { categoryId: staff.id, name: 'سلف', systemKey: 'BUSINESS_STAFF_ADVANCE' },
          { categoryId: staff.id, name: 'مصاريف سفر العاملين', systemKey: 'BUSINESS_STAFF_TRAVEL' },
        ] });
        const marketing = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'التسويق والمبيعات', systemKey: 'BUSINESS_MARKETING' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: marketing.id, name: 'إعلانات', systemKey: 'BUSINESS_MARKETING_ADS' },
          { categoryId: marketing.id, name: 'تسويق إلكتروني', systemKey: 'BUSINESS_MARKETING_DIGITAL' },
          { categoryId: marketing.id, name: 'تصميم وطباعة', systemKey: 'BUSINESS_MARKETING_PRINT' },
          { categoryId: marketing.id, name: 'عروض وخصومات', systemKey: 'BUSINESS_MARKETING_OFFERS' },
          { categoryId: marketing.id, name: 'عمولات مندوبي المبيعات', systemKey: 'BUSINESS_MARKETING_REP_COMM' },
        ] });
        const assets = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'الأصول والمعدات', systemKey: 'BUSINESS_ASSETS' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: assets.id, name: 'أجهزة', systemKey: 'BUSINESS_ASSETS_DEVICES' },
          { categoryId: assets.id, name: 'أثاث', systemKey: 'BUSINESS_ASSETS_FURNITURE' },
          { categoryId: assets.id, name: 'أدوات ومعدات', systemKey: 'BUSINESS_ASSETS_TOOLS' },
          { categoryId: assets.id, name: 'سيارات', systemKey: 'BUSINESS_ASSETS_CARS' },
          { categoryId: assets.id, name: 'صيانة معدات', systemKey: 'BUSINESS_ASSETS_MAINT' },
          { categoryId: assets.id, name: 'شراء أصل', systemKey: 'BUSINESS_ASSETS_BUY' },
          { categoryId: assets.id, name: 'بيع أصل', systemKey: 'BUSINESS_ASSETS_SELL' },
        ] });
        const crm = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'العملاء والموردون', systemKey: 'BUSINESS_CRM' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: crm.id, name: 'عملاء', systemKey: 'BUSINESS_CRM_CUSTOMERS' },
          { categoryId: crm.id, name: 'موردون', systemKey: 'BUSINESS_CRM_SUPPLIERS' },
          { categoryId: crm.id, name: 'شركاء', systemKey: 'BUSINESS_CRM_PARTNERS' },
          { categoryId: crm.id, name: 'سلف للموظفين', systemKey: 'BUSINESS_CRM_EMP_ADVANCE' },
          { categoryId: crm.id, name: 'ديون مستحقة', systemKey: 'BUSINESS_CRM_RECEIVABLES' },
          { categoryId: crm.id, name: 'تحصيلات', systemKey: 'BUSINESS_CRM_COLLECTIONS' },
          { categoryId: crm.id, name: 'دفعات للموردين', systemKey: 'BUSINESS_CRM_PAYMENTS' },
        ] });
        const taxes = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'الضرائب والرسوم', systemKey: 'BUSINESS_TAXES' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: taxes.id, name: 'رسوم حكومية', systemKey: 'BUSINESS_TAXES_GOV' },
          { categoryId: taxes.id, name: 'تراخيص', systemKey: 'BUSINESS_TAXES_LICENSES' },
          { categoryId: taxes.id, name: 'ضرائب', systemKey: 'BUSINESS_TAXES_TAX' },
          { categoryId: taxes.id, name: 'جمارك', systemKey: 'BUSINESS_TAXES_CUSTOMS' },
          { categoryId: taxes.id, name: 'مخالفات', systemKey: 'BUSINESS_TAXES_VIOLATIONS' },
        ] });
        const finance = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'التمويل والتحويلات', systemKey: 'BUSINESS_FINANCE' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: finance.id, name: 'رأس مال', systemKey: 'BUSINESS_FINANCE_CAPITAL' },
          { categoryId: finance.id, name: 'سحب المالك', systemKey: 'BUSINESS_FINANCE_DRAWING' },
          { categoryId: finance.id, name: 'قرض مستلم', systemKey: 'BUSINESS_FINANCE_LOAN_IN' },
          { categoryId: finance.id, name: 'سداد قرض', systemKey: 'BUSINESS_FINANCE_LOAN_OUT' },
          { categoryId: finance.id, name: 'تحويل بين الحسابات', systemKey: 'BUSINESS_FINANCE_TRANSFERS' },
          { categoryId: finance.id, name: 'إيداع بنكي', systemKey: 'BUSINESS_FINANCE_DEPOSIT' },
          { categoryId: finance.id, name: 'سحب نقدي', systemKey: 'BUSINESS_FINANCE_WITHDRAWAL' },
        ] });
        const otherInc = await tx.category.create({ data: { ledgerId: ledger.id, kind: 'MAIN', name: 'إيرادات أخرى', systemKey: 'BUSINESS_OTHER_INC' } });
        await tx.categoryItem.createMany({ data: [
          { categoryId: otherInc.id, name: 'دخل استشارات', systemKey: 'BUSINESS_OTHER_INC_CONSULT' },
          { categoryId: otherInc.id, name: 'دخل تأجير', systemKey: 'BUSINESS_OTHER_INC_RENT' },
          { categoryId: otherInc.id, name: 'أرباح أخرى', systemKey: 'BUSINESS_OTHER_INC_PROFIT' },
          { categoryId: otherInc.id, name: 'استردادات', systemKey: 'BUSINESS_OTHER_INC_REFUNDS' },
          { categoryId: otherInc.id, name: 'إيرادات متنوعة', systemKey: 'BUSINESS_OTHER_INC_MISC' },
        ] });
      }

      return ledger;
    });
  }

  /**
   * تحديث الإعدادات: يجمع الحقول المسموح بها صراحةً فقط، فلا يمكن تغيير
   * `type` أو `baseCurrencyId` عبر جسم الطلب — عقد §7.1 يجعلهما ثابتين.
   */
  async updateSettings(id: string, ownerId: string, dto: UpdateLedgerSettingsDto) {
    if (!this.isUuid(id)) throw new NotFoundException('Ledger not found');
    const l = await this.prisma.ledger.findUnique({ where: { id } });
    if (!l) throw new NotFoundException('Ledger not found');
    if (l.ownerId !== ownerId) throw new ForbiddenException();

    const data: UpdateLedgerSettingsDto = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.budgetsEnabled !== undefined) data.budgetsEnabled = dto.budgetsEnabled;
    if (dto.stockEnabled !== undefined) data.stockEnabled = dto.stockEnabled;
    if (dto.taxEnabled !== undefined) data.taxEnabled = dto.taxEnabled;

    return this.prisma.ledger.update({ where: { id }, data });
  }
}
