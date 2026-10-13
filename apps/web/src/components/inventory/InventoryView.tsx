"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, EmptyState, ErrorMessage, LoadingBlock } from "@/components/Feedback";
import { Field, Select, TextInput } from "@/components/Form";
import { StatusPill } from "@/components/StatusPill";
import { useLocale, useTranslations } from "@/components/LocaleProvider";
import { useSession } from "@/components/SessionProvider";
import { useLedgerContext } from "@/hooks/useLedgerContext";
import {
  archiveProduct,
  can,
  createProduct,
  createStockMovement,
  fetchProductMovements,
  fetchProductStock,
  fetchProducts,
  fetchWarehouses,
  type CreateStockMovementInput,
  type Product,
  type ProductStock,
  type StockMovement,
  type Warehouse,
} from "@/lib/api-client";
import { formatAmount, formatDate } from "@/lib/format";
import { kindLabel, MANUAL_TYPES, movementLabel, movementTone, warehouseName } from "./inventory-labels";

type ProductForm = {
  kind: "GOOD" | "SERVICE";
  name: string;
  sku: string;
  unitPrice: string;
  costPrice: string;
  trackStock: boolean;
  defaultWarehouseId: string;
};

const EMPTY_PRODUCT_FORM: ProductForm = {
  kind: "GOOD",
  name: "",
  sku: "",
  unitPrice: "",
  costPrice: "",
  trackStock: true,
  defaultWarehouseId: "",
};

type MovementForm = {
  productId: string;
  warehouseId: string;
  type: CreateStockMovementInput["type"];
  quantity: string;
  reason: string;
  businessDate: string;
};

const EMPTY_MOVEMENT_FORM: MovementForm = {
  productId: "",
  warehouseId: "",
  type: "RETURN_IN",
  quantity: "",
  reason: "",
  businessDate: "",
};

export function InventoryView({ ledgerId }: { ledgerId: string }) {
  const t = useTranslations();
  const { locale } = useLocale();
  const { token } = useSession();
  const { permissions, loading: contextLoading } = useLedgerContext(token, ledgerId);

  const canView = can(permissions, "inventoryView");
  const canManage = can(permissions, "inventoryManage");
  const canMove = can(permissions, "create");

  const [reloadKey, setReloadKey] = useState(0);
  const [detailKey, setDetailKey] = useState(0);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [listError, setListError] = useState<unknown>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [stock, setStock] = useState<ProductStock | null>(null);
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [detailError, setDetailError] = useState<unknown>(null);

  const [form, setForm] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [formError, setFormError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const [movement, setMovement] = useState<MovementForm>(EMPTY_MOVEMENT_FORM);
  const [movementError, setMovementError] = useState<unknown>(null);
  const [movementBusy, setMovementBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      try {
        const [nextProducts, nextWarehouses] = await Promise.all([
          fetchProducts(token, ledgerId, undefined, signal),
          fetchWarehouses(token, ledgerId, signal),
        ]);
        if (signal.aborted) return;
        setProducts(nextProducts);
        setWarehouses(nextWarehouses);
        setListError(null);
        setSelectedId((current) => current ?? nextProducts[0]?.id ?? null);
      } catch (caught) {
        if (signal.aborted) return;
        setProducts([]);
        setWarehouses([]);
        setListError(caught);
      }
    })();
    return () => controller.abort();
  }, [token, ledgerId, reloadKey]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      try {
        const [nextStock, nextMovements] = await Promise.all([
          fetchProductStock(token, ledgerId, selectedId, signal),
          fetchProductMovements(token, ledgerId, selectedId, undefined, signal),
        ]);
        if (signal.aborted) return;
        setStock(nextStock);
        setMovements(nextMovements);
        setDetailError(null);
      } catch (caught) {
        if (signal.aborted) return;
        setStock(null);
        setMovements(null);
        setDetailError(caught);
      }
    })();
    return () => controller.abort();
  }, [token, ledgerId, selectedId, detailKey]);

  const selected = products?.find((product) => product.id === selectedId) ?? null;
  const stockedProducts =
    products?.filter((product) => product.kind === "GOOD" && product.trackStock && !product.archivedAt) ??
    [];
  const warehouseList = warehouses ?? [];
  const activeWarehouses = warehouseList.filter((warehouse) => !warehouse.archivedAt);
  const busy = products === null || warehouses === null;

  function retry() {
    setListError(null);
    setReloadKey((key) => key + 1);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const trackStock = form.kind === "GOOD" && form.trackStock;
      const created = await createProduct(token, ledgerId, {
        kind: form.kind,
        name: form.name.trim(),
        unitPrice: form.unitPrice.trim(),
        ...(form.sku.trim() ? { sku: form.sku.trim() } : {}),
        ...(form.costPrice.trim() ? { costPrice: form.costPrice.trim() } : {}),
        trackStock,
        ...(trackStock && form.defaultWarehouseId
          ? { defaultWarehouseId: form.defaultWarehouseId }
          : {}),
      });
      setProducts((rows) => [...(rows ?? []), created]);
      setSelectedId(created.id);
      setForm(EMPTY_PRODUCT_FORM);
      setNotice(t("inv.created"));
    } catch (caught) {
      setFormError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(productId: string) {
    setListError(null);
    try {
      await archiveProduct(token, ledgerId, productId);
      setProducts((rows) => (rows ?? []).filter((row) => row.id !== productId));
      if (selectedId === productId) setSelectedId(null);
      setNotice(t("inv.archived"));
    } catch (caught) {
      setListError(caught);
    }
  }

  async function handleMovement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMovementBusy(true);
    setMovementError(null);
    try {
      await createStockMovement(token, ledgerId, {
        productId: movement.productId,
        warehouseId: movement.warehouseId,
        type: movement.type,
        quantity: movement.quantity.trim(),
        ...(movement.reason.trim() ? { reason: movement.reason.trim() } : {}),
        ...(movement.businessDate ? { businessDate: movement.businessDate } : {}),
      });
      setNotice(t("inv.manualCreated"));
      setMovement((current) => ({ ...current, quantity: "", reason: "" }));
      setDetailKey((key) => key + 1);
    } catch (caught) {
      setMovementError(caught);
    } finally {
      setMovementBusy(false);
    }
  }

  return (
    <AppShell
      title={t("inv.title")}
      subtitle={t("inv.subtitle")}
      ledgerHref="/ledgers"
      actions={
        <Link href={`/ledgers/${ledgerId}/inventory/warehouses`}>
          <Button variant="secondary" size="sm">
            {t("inv.manageWarehouses")}
          </Button>
        </Link>
      }
    >
      {contextLoading ? (
        <LoadingBlock label={t("nav.loading")} />
      ) : !canView ? (
        <EmptyState message={t("inv.noPermission")} />
      ) : (
        <div className="flex flex-col gap-6">
          {listError ? <ErrorMessage error={listError} onRetry={retry} /> : null}
          {notice ? (
            <p
              role="status"
              className="rounded-lg border border-line-subtle bg-surface-raised px-4 py-2 text-sm text-ink-secondary"
            >
              {notice}
            </p>
          ) : null}
          {busy ? <LoadingBlock label={t("nav.loading")} /> : null}

          {!busy ? (
            <section aria-labelledby="inv-products-heading">
              <h2
                id="inv-products-heading"
                className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase"
              >
                {t("inv.productsHeading")}
              </h2>
              {products.length === 0 ? (
                <EmptyState message={t("inv.empty")} />
              ) : (
                <ul className="flex flex-col gap-3">
                  {products.map((product) => {
                    const isSelected = product.id === selectedId;
                    return (
                      <li key={product.id}>
                        <Card
                          className={`flex flex-wrap items-center justify-between gap-4 ${
                            isSelected ? "border-accent" : ""
                          }`}
                        >
                          <div className="flex min-w-0 flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill tone={product.kind === "GOOD" ? "info" : "neutral"}>
                                {kindLabel(t, product.kind)}
                              </StatusPill>
                              {product.archivedAt ? (
                                <StatusPill tone="expense">{t("inv.archivedBadge")}</StatusPill>
                              ) : null}
                            </div>
                            <p className="truncate text-base font-semibold">{product.name}</p>
                            <p className="hesab-numeric truncate text-xs text-ink-muted" dir="ltr">
                              {product.sku ?? "—"} · {t("inv.unitPrice")}:{" "}
                              {formatAmount(product.unitPrice, locale)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedId(product.id)}
                              aria-pressed={isSelected}
                            >
                              {t("inv.view")}
                            </Button>
                            {canManage && !product.archivedAt ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleArchive(product.id)}
                              >
                                {t("inv.archive")}
                              </Button>
                            ) : null}
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}

          {!busy && selected ? (
            <section aria-labelledby="inv-balance-heading">
              <h2
                id="inv-balance-heading"
                className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase"
              >
                {t("inv.balanceHeading")}
              </h2>
              {detailError ? (
                <ErrorMessage error={detailError} onRetry={() => setDetailKey((key) => key + 1)} />
              ) : null}
              {!detailError && stock ? (
                <Card className="flex flex-col gap-4">
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-ink-muted">{t("inv.quantity")}</dt>
                      <dd className="hesab-numeric font-semibold" dir="ltr">
                        {formatAmount(stock.quantity, locale)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-muted">{t("inv.value")}</dt>
                      <dd className="hesab-numeric font-semibold" dir="ltr">
                        {formatAmount(stock.value, locale)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-muted">{t("inv.wac")}</dt>
                      <dd className="hesab-numeric font-semibold" dir="ltr">
                        {formatAmount(stock.wac, locale)}
                      </dd>
                    </div>
                  </dl>

                  {stock.warehouses.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <caption className="sr-only">{t("inv.byWarehouse")}</caption>
                        <thead>
                          <tr className="text-xs text-ink-muted">
                            <th scope="col" className="px-2 py-2 text-start font-medium">
                              {t("inv.manualWarehouse")}
                            </th>
                            <th scope="col" className="px-2 py-2 text-start font-medium">
                              {t("inv.quantity")}
                            </th>
                            <th scope="col" className="px-2 py-2 text-start font-medium">
                              {t("inv.value")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {stock.warehouses.map((bucket) => (
                            <tr key={bucket.warehouseId} className="border-t border-line-subtle">
                              <td className="px-2 py-2">
                                {warehouseName(warehouseList, bucket.warehouseId)}
                              </td>
                              <td className="hesab-numeric px-2 py-2" dir="ltr">
                                {formatAmount(bucket.quantity, locale)}
                              </td>
                              <td className="hesab-numeric px-2 py-2" dir="ltr">
                                {formatAmount(bucket.value, locale)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </Card>
              ) : null}
            </section>
          ) : null}

          {!busy && selected ? (
            <section aria-labelledby="inv-movements-heading">
              <h2
                id="inv-movements-heading"
                className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase"
              >
                {t("inv.movementsHeading")}
              </h2>
              {movements === null ? (
                <LoadingBlock label={t("nav.loading")} />
              ) : movements.length === 0 ? (
                <EmptyState message={t("inv.movementsEmpty")} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-ink-muted">
                        <th scope="col" className="px-2 py-2 text-start font-medium">
                          {t("inv.movementType")}
                        </th>
                        <th scope="col" className="px-2 py-2 text-start font-medium">
                          {t("inv.quantity")}
                        </th>
                        <th scope="col" className="px-2 py-2 text-start font-medium">
                          {t("inv.movementCost")}
                        </th>
                        <th scope="col" className="px-2 py-2 text-start font-medium">
                          {t("inv.manualWarehouse")}
                        </th>
                        <th scope="col" className="px-2 py-2 text-start font-medium">
                          {t("inv.movementDate")}
                        </th>
                        <th scope="col" className="px-2 py-2 text-start font-medium">
                          {t("inv.movementNote")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((row) => (
                        <tr key={row.id} className="border-t border-line-subtle">
                          <td className="px-2 py-2">
                            <StatusPill tone={movementTone(row.type)}>
                              {movementLabel(t, row.type)}
                            </StatusPill>
                          </td>
                          <td className="hesab-numeric px-2 py-2" dir="ltr">
                            {formatAmount(row.quantity, locale)}
                          </td>
                          <td className="hesab-numeric px-2 py-2" dir="ltr">
                            {row.unitCost ? formatAmount(row.unitCost, locale) : t("common.none")}
                          </td>
                          <td className="px-2 py-2">
                            {warehouseName(warehouseList, row.warehouseId)}
                          </td>
                          <td className="px-2 py-2" dir="ltr">
                            {formatDate(row.businessDate, locale)}
                          </td>
                          <td className="px-2 py-2">{row.note ?? t("common.none")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {!busy && !selected ? (
            <p className="text-xs text-ink-muted">{t("inv.selectHint")}</p>
          ) : null}

          {!busy && canMove && stockedProducts.length > 0 ? (
            <section aria-labelledby="inv-manual-heading">
              <h2
                id="inv-manual-heading"
                className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase"
              >
                {t("inv.manualHeading")}
              </h2>
              <Card>
                <form className="flex flex-col gap-4" onSubmit={handleMovement}>
                  <p className="text-xs text-ink-muted">{t("inv.manualHint")}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("inv.manualProduct")} htmlFor="inv-mov-product" required>
                      <Select
                        id="inv-mov-product"
                        required
                        value={movement.productId}
                        onChange={(event) =>
                          setMovement({ ...movement, productId: event.target.value })
                        }
                      >
                        <option value="">—</option>
                        {stockedProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("inv.manualWarehouse")} htmlFor="inv-mov-warehouse" required>
                      <Select
                        id="inv-mov-warehouse"
                        required
                        value={movement.warehouseId}
                        onChange={(event) =>
                          setMovement({ ...movement, warehouseId: event.target.value })
                        }
                      >
                        <option value="">—</option>
                        {activeWarehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("inv.manualType")} htmlFor="inv-mov-type">
                      <Select
                        id="inv-mov-type"
                        value={movement.type}
                        onChange={(event) =>
                          setMovement({
                            ...movement,
                            type: event.target.value as MovementForm["type"],
                          })
                        }
                      >
                        {MANUAL_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {movementLabel(t, type)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("inv.manualQuantity")} htmlFor="inv-mov-quantity" required>
                      <TextInput
                        id="inv-mov-quantity"
                        required
                        inputMode="decimal"
                        value={movement.quantity}
                        onChange={(event) =>
                          setMovement({ ...movement, quantity: event.target.value })
                        }
                      />
                    </Field>
                    <Field
                      label={t("inv.manualDate")}
                      htmlFor="inv-mov-date"
                      hint={t("common.optional")}
                    >
                      <TextInput
                        id="inv-mov-date"
                        type="date"
                        value={movement.businessDate}
                        onChange={(event) =>
                          setMovement({ ...movement, businessDate: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <Field
                    label={t("inv.manualReason")}
                    htmlFor="inv-mov-reason"
                    hint={t("common.optional")}
                  >
                    <TextInput
                      id="inv-mov-reason"
                      value={movement.reason}
                      onChange={(event) => setMovement({ ...movement, reason: event.target.value })}
                    />
                  </Field>
                  {movementError ? <ErrorMessage error={movementError} /> : null}
                  <div>
                    <Button type="submit" size="sm" disabled={movementBusy}>
                      {movementBusy ? t("inv.manualSubmitting") : t("inv.manualSubmit")}
                    </Button>
                  </div>
                </form>
              </Card>
            </section>
          ) : null}

          {!busy && canManage ? (
            <section aria-labelledby="inv-new-heading">
              <h2
                id="inv-new-heading"
                className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase"
              >
                {t("inv.newHeading")}
              </h2>
              <Card>
                <form className="flex flex-col gap-4" onSubmit={handleCreate}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("inv.name")} htmlFor="inv-name" required>
                      <TextInput
                        id="inv-name"
                        required
                        value={form.name}
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                      />
                    </Field>
                    <Field label={t("inv.kind")} htmlFor="inv-kind">
                      <Select
                        id="inv-kind"
                        value={form.kind}
                        onChange={(event) =>
                          setForm({ ...form, kind: event.target.value as ProductForm["kind"] })
                        }
                      >
                        <option value="GOOD">{kindLabel(t, "GOOD")}</option>
                        <option value="SERVICE">{kindLabel(t, "SERVICE")}</option>
                      </Select>
                    </Field>
                    <Field label={t("inv.unitPrice")} htmlFor="inv-unit-price" required>
                      <TextInput
                        id="inv-unit-price"
                        required
                        inputMode="decimal"
                        value={form.unitPrice}
                        onChange={(event) => setForm({ ...form, unitPrice: event.target.value })}
                      />
                    </Field>
                    <Field
                      label={t("inv.costPrice")}
                      htmlFor="inv-cost-price"
                      hint={t("common.optional")}
                    >
                      <TextInput
                        id="inv-cost-price"
                        inputMode="decimal"
                        value={form.costPrice}
                        onChange={(event) => setForm({ ...form, costPrice: event.target.value })}
                      />
                    </Field>
                    <Field label={t("inv.sku")} htmlFor="inv-sku" hint={t("common.optional")}>
                      <TextInput
                        id="inv-sku"
                        value={form.sku}
                        onChange={(event) => setForm({ ...form, sku: event.target.value })}
                      />
                    </Field>
                  </div>

                  {form.kind === "GOOD" ? (
                    <label className="flex items-center gap-2 text-sm text-ink-secondary">
                      <input
                        type="checkbox"
                        checked={form.trackStock}
                        onChange={(event) => setForm({ ...form, trackStock: event.target.checked })}
                      />
                      {t("inv.trackStock")}
                    </label>
                  ) : null}

                  {form.kind === "GOOD" && form.trackStock ? (
                    <Field
                      label={t("inv.defaultWarehouse")}
                      htmlFor="inv-default-warehouse"
                      hint={t("common.optional")}
                    >
                      <Select
                        id="inv-default-warehouse"
                        value={form.defaultWarehouseId}
                        onChange={(event) =>
                          setForm({ ...form, defaultWarehouseId: event.target.value })
                        }
                      >
                        <option value="">{t("inv.noWarehouse")}</option>
                        {activeWarehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : null}

                  {activeWarehouses.length === 0 ? (
                    <p className="text-xs text-ink-muted">{t("inv.noWarehouses")}</p>
                  ) : null}
                  {formError ? <ErrorMessage error={formError} /> : null}
                  <div>
                    <Button type="submit" size="sm" disabled={submitting}>
                      {submitting ? t("inv.creating") : t("inv.create")}
                    </Button>
                  </div>
                </form>
              </Card>
            </section>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
