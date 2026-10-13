/**
 * مفردات وحدة المخزون. `kind` مشتق من `ProductKind` في المخطّط، ولا يوجد
 * `isService` (قرار المخطّط)؛ الخدمة تُشتق من `kind = SERVICE`.
 */
export const PRODUCT_KINDS = ['GOOD', 'SERVICE'] as const;
export type ProductKindInput = (typeof PRODUCT_KINDS)[number];

/** أنواع المسودة التي تُدخل المخزون (حركة مشتريات موجبة). */
export const PURCHASE_KINDS = ['PURCHASE_CASH', 'PURCHASE_CREDIT'] as const;
/** أنواع المسودة التي تُخرج المخزون (حركة مبيعات سالبة + COGS). */
export const SALE_KINDS = ['SALE_CASH', 'SALE_CREDIT'] as const;

const PURCHASE_SET = new Set<string>(PURCHASE_KINDS);
const SALE_SET = new Set<string>(SALE_KINDS);

export function isPurchaseKind(kind: string): boolean {
  return PURCHASE_SET.has(kind);
}

export function isSaleKind(kind: string): boolean {
  return SALE_SET.has(kind);
}

export function isCommercialKind(kind: string): boolean {
  return PURCHASE_SET.has(kind) || SALE_SET.has(kind);
}

/**
 * أنواع الحركة اليدوية المسموح بها عبر `POST /stock-movements`. لا تُقبل
 * `PURCHASE`/`SALE` هنا لأنها محصورة باعتماد مسودات المبيعات/المشتريات.
 */
export const MANUAL_MOVEMENT_TYPES = [
  'RETURN_IN',
  'RETURN_OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
] as const;
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number];

const MANUAL_SET = new Set<string>(MANUAL_MOVEMENT_TYPES);
const INBOUND_SET = new Set<string>(['RETURN_IN', 'ADJUSTMENT_IN']);

export function isManualMovementType(type: string): type is ManualMovementType {
  return MANUAL_SET.has(type);
}

/** الوارد يزيد الرصيد، والصادر يخصمه. الاتجاه من النوع لا من إشارة العميل. */
export function isInboundMovement(type: string): boolean {
  return INBOUND_SET.has(type);
}
