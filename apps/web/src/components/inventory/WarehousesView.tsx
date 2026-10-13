"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, EmptyState, ErrorMessage, LoadingBlock } from "@/components/Feedback";
import { Field, TextInput } from "@/components/Form";
import { StatusPill } from "@/components/StatusPill";
import { useTranslations } from "@/components/LocaleProvider";
import { useSession } from "@/components/SessionProvider";
import { can, createWarehouse, archiveWarehouse, fetchWarehouses, updateWarehouse, type Warehouse } from "@/lib/api-client";
import { useLedgerContext } from "@/hooks/useLedgerContext";

export function WarehousesView({ ledgerId }: { ledgerId: string }) {
  const t = useTranslations();
  const { token } = useSession();
  const { permissions, loading: contextLoading } = useLedgerContext(token, ledgerId);

  const canView = can(permissions, "inventoryView");
  const canManage = can(permissions, "inventoryManage");

  const [reloadKey, setReloadKey] = useState(0);
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      try {
        const rows = await fetchWarehouses(token, ledgerId, signal);
        if (signal.aborted) return;
        setWarehouses(rows);
        setError(null);
      } catch (caught) {
        if (signal.aborted) return;
        setWarehouses([]);
        setError(caught);
      }
    })();
    return () => controller.abort();
  }, [token, ledgerId, reloadKey]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await createWarehouse(token, ledgerId, {
        name: name.trim(),
        ...(isDefault ? { isDefault: true } : {}),
      });
      setWarehouses((rows) =>
        isDefault
          ? [...(rows ?? []).map((row) => ({ ...row, isDefault: false })), created]
          : [...(rows ?? []), created],
      );
      setName("");
      setIsDefault(false);
    } catch (caught) {
      setFormError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMakeDefault(warehouseId: string) {
    setBusyId(warehouseId);
    setError(null);
    try {
      await updateWarehouse(token, ledgerId, warehouseId, { isDefault: true });
      setWarehouses((rows) =>
        (rows ?? []).map((row) => ({ ...row, isDefault: row.id === warehouseId })),
      );
    } catch (caught) {
      setError(caught);
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchive(warehouseId: string) {
    setBusyId(warehouseId);
    setError(null);
    try {
      await archiveWarehouse(token, ledgerId, warehouseId);
      setWarehouses((rows) => (rows ?? []).filter((row) => row.id !== warehouseId));
    } catch (caught) {
      setError(caught);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell
      title={t("inv.warehousesTitle")}
      subtitle={t("inv.warehousesSubtitle")}
      ledgerHref={`/ledgers/${ledgerId}/inventory`}
      actions={
        <Link href={`/ledgers/${ledgerId}/inventory`}>
          <Button variant="secondary" size="sm">
            {t("inv.backToInventory")}
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
          {error ? <ErrorMessage error={error} onRetry={() => setReloadKey((k) => k + 1)} /> : null}

          <section aria-labelledby="inv-wr-list-heading">
            <h2
              id="inv-wr-list-heading"
              className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase"
            >
              {t("inv.warehousesTitle")}
            </h2>
            {warehouses === null ? (
              <LoadingBlock label={t("nav.loading")} />
            ) : warehouses.length === 0 ? (
              <EmptyState message={t("inv.warehousesEmpty")} />
            ) : (
              <ul className="flex flex-col gap-3">
                {warehouses.map((warehouse) => (
                  <li key={warehouse.id}>
                    <Card className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{warehouse.name}</span>
                        {warehouse.isDefault ? (
                          <StatusPill tone="info">{t("inv.warehouse.default")}</StatusPill>
                        ) : null}
                      </div>
                      {canManage ? (
                        <div className="flex flex-wrap gap-2">
                          {!warehouse.isDefault ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busyId === warehouse.id}
                              onClick={() => handleMakeDefault(warehouse.id)}
                            >
                              {t("inv.warehouse.makeDefault")}
                            </Button>
                          ) : null}
                          {!warehouse.isDefault ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busyId === warehouse.id}
                              onClick={() => handleArchive(warehouse.id)}
                            >
                              {t("inv.warehouse.archive")}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canManage ? (
            <section aria-labelledby="inv-wr-new-heading">
              <h2
                id="inv-wr-new-heading"
                className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase"
              >
                {t("inv.warehouse.newHeading")}
              </h2>
              <Card>
                <form className="flex flex-col gap-4" onSubmit={handleCreate}>
                  <Field label={t("inv.warehouse.name")} htmlFor="inv-wr-name" required>
                    <TextInput
                      id="inv-wr-name"
                      required
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm text-ink-secondary">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(event) => setIsDefault(event.target.checked)}
                    />
                    {t("inv.warehouse.makeDefault")}
                  </label>
                  {formError ? <ErrorMessage error={formError} /> : null}
                  <div>
                    <Button type="submit" size="sm" disabled={submitting}>
                      {submitting ? t("inv.warehouse.creating") : t("inv.warehouse.create")}
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
