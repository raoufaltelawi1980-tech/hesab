/**
 * رموز رفض مستقرة لوحدة المخزون. تُسبق الرسالة العربية (`CODE: رسالة`) لأن
 * استجابات هذا الـAPI نصية فقط.
 */
export const INVENTORY_ERROR_CODES = {
  /** المخزون متاح للدفتر التجاري فقط. */
  LEDGER_NOT_BUSINESS: 'LEDGER_NOT_BUSINESS',
  /** `Ledger.stockEnabled = false` — مسارات المخزون مغلقة. */
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  PRODUCT_ARCHIVED: 'PRODUCT_ARCHIVED',
  PRODUCT_KIND_INVALID: 'PRODUCT_KIND_INVALID',
  /** لا يُربط مستودع افتراضي بمنتج غير مخزَّن، والخدمة لا تدخل المخزون. */
  PRODUCT_NOT_STOCKED: 'PRODUCT_NOT_STOCKED',
  SKU_DUPLICATE: 'SKU_DUPLICATE',
  WAREHOUSE_NOT_FOUND: 'WAREHOUSE_NOT_FOUND',
  WAREHOUSE_ARCHIVED: 'WAREHOUSE_ARCHIVED',
  /** لا يمكن أرشفة المستودع الافتراضي لأنه لا بديل له. */
  WAREHOUSE_DEFAULT: 'WAREHOUSE_DEFAULT',
  /** لا يوجد مستودع افتراضي لترحيل الحركة. */
  WAREHOUSE_REQUIRED: 'WAREHOUSE_REQUIRED',
  INVALID_QUANTITY: 'INVALID_QUANTITY',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  /** النوع المرسل عبر المسار اليدوي ليس من أنواع الحركة اليدوية الأربعة. */
  MOVEMENT_TYPE_INVALID: 'MOVEMENT_TYPE_INVALID',
} as const;

export type InventoryErrorCode =
  (typeof INVENTORY_ERROR_CODES)[keyof typeof INVENTORY_ERROR_CODES];
