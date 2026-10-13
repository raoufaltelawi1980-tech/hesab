import type { MessageKey } from "@/lib/messages";
import type { ProductKind, StockMovementType, Warehouse } from "@/lib/api-client";

/**
 * Pure label helpers. They take `t` instead of reading the locale hook so they
 * stay testable outside a React tree, and so a missing key surfaces as the key
 * rather than as an empty label.
 */
export type Translate = (key: MessageKey) => string;

const KIND_KEYS: Record<ProductKind, MessageKey> = {
  GOOD: "inv.kind.good",
  SERVICE: "inv.kind.service",
};

const MOVEMENT_KEYS: Record<StockMovementType, MessageKey> = {
  PURCHASE: "inv.type.PURCHASE",
  SALE: "inv.type.SALE",
  RETURN_IN: "inv.type.RETURN_IN",
  RETURN_OUT: "inv.type.RETURN_OUT",
  ADJUSTMENT_IN: "inv.type.ADJUSTMENT_IN",
  ADJUSTMENT_OUT: "inv.type.ADJUSTMENT_OUT",
};

export const MANUAL_TYPES: StockMovementType[] = [
  "RETURN_IN",
  "RETURN_OUT",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
];

export function kindLabel(t: Translate, kind: ProductKind): string {
  return t(KIND_KEYS[kind]);
}

export function movementLabel(t: Translate, type: StockMovementType): string {
  return t(MOVEMENT_KEYS[type]);
}

export function movementTone(
  type: StockMovementType,
): "income" | "expense" | "neutral" {
  if (type === "PURCHASE" || type === "RETURN_IN" || type === "ADJUSTMENT_IN") return "income";
  if (type === "SALE" || type === "RETURN_OUT" || type === "ADJUSTMENT_OUT") return "expense";
  return "neutral";
}

export function isInbound(type: StockMovementType): boolean {
  return type === "PURCHASE" || type === "RETURN_IN" || type === "ADJUSTMENT_IN";
}

/** Falls back to a dash so an unknown or archived warehouse never renders blank. */
export function warehouseName(warehouses: Warehouse[], warehouseId: string | null): string {
  if (!warehouseId) return "—";
  return warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ?? "—";
}
