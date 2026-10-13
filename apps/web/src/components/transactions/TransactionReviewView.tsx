"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, ErrorMessage, LoadingBlock } from "@/components/Feedback";
import { Field, Select, TextArea, TextInput } from "@/components/Form";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { KindBadge, StatusPill } from "@/components/StatusPill";
import { useLocale, useTranslations } from "@/components/LocaleProvider";
import { useSession } from "@/components/SessionProvider";
import {
  can,
  canPost,
  confirmDraft,
  fetchDraft,
  postDraft,
  updateDraft,
  type ReviewPayload,
  type UpdateDraftInput,
} from "@/lib/api-client";
import { formatAmount, formatDate } from "@/lib/format";
import { useLedgerContext, selectableItems } from "@/hooks/useLedgerContext";
import type { MessageKey } from "@/lib/messages";

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line-subtle py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm font-medium break-words">{value}</span>
    </div>
  );
}

export function TransactionReviewView({
  ledgerId,
  draftId,
}: {
  ledgerId: string;
  draftId: string;
}) {
  const t = useTranslations();
  const { locale } = useLocale();
  const { token } = useSession();
  const { accounts, categories, permissions } = useLedgerContext(token, ledgerId);

  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<{
    requestKey: string;
    draft: Awaited<ReturnType<typeof fetchDraft>>["draft"] | null;
    review: ReviewPayload | null;
    error: unknown;
  }>({ requestKey: "", draft: null, review: null, error: null });
  const [busy, setBusy] = useState<null | "confirm" | "post" | "save">(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryItemId, setCategoryItemId] = useState("");
  const [description, setDescription] = useState("");
  const [businessDate, setBusinessDate] = useState("");

  const requestKey = `${token ?? "anon"}:${ledgerId}:${draftId}:${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const key = `${token ?? "anon"}:${ledgerId}:${draftId}:${reloadKey}`;

    void (async () => {
      try {
        const result = await fetchDraft(token, ledgerId, draftId, signal);
        if (signal.aborted) return;
        setLoaded({ requestKey: key, draft: result.draft, review: result.review, error: null });
        setAmount(String(result.draft.originalAmount ?? ""));
        setDescription(result.draft.description ?? "");
        setBusinessDate(result.draft.businessDate ? result.draft.businessDate.slice(0, 10) : "");
        const line = result.draft.lines[0];
        setAccountId(line?.accountId ?? "");
        setCategoryId(line?.categoryId ?? "");
        setCategoryItemId(line?.categoryItemId ?? "");
      } catch (caught) {
        if (signal.aborted) return;
        setLoaded({ requestKey: key, draft: null, review: null, error: caught });
      }
    })();

    return () => controller.abort();
  }, [token, ledgerId, draftId, reloadKey]);

  const fresh = loaded.requestKey === requestKey;
  const loading = !fresh;
  const error = fresh ? loaded.error : null;
  const draft = fresh ? loaded.draft : null;
  const review = fresh ? loaded.review : null;

  const [actionError, setActionError] = useState<unknown>(null);

  function retry() {
    setActionError(null);
    setReloadKey((k) => k + 1);
  }

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const availableItems = selectableItems(selectedCategory);
  const status = draft?.status ?? "DRAFT";
  const editable = status === "DRAFT";
  const mayConfirm = can(permissions, "confirm");
  const mayPost = canPost(permissions);

  async function handleSave() {
    setActionError(null);
    setNotice(null);
    setBusy("save");
    try {
      const payload: UpdateDraftInput = {
        amount: amount.trim(),
        description: description.trim(),
      };
      if (accountId) payload.financialAccountId = accountId;
      if (categoryId) payload.categoryId = categoryId;
      if (categoryItemId) payload.categoryItemId = categoryItemId;
      if (businessDate) payload.businessDate = businessDate;

      const result = await updateDraft(token, ledgerId, draftId, payload);
      if (result.review) {
        setLoaded((prev) => ({ ...prev, review: result.review }));
      }
      setNotice(t("review.saved"));
      setReloadKey((k) => k + 1);
    } catch (caught) {
      setActionError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function handleConfirm() {
    setActionError(null);
    setNotice(null);
    setBusy("confirm");
    try {
      const result = await confirmDraft(token, ledgerId, draftId);
      if (result.review) {
        setLoaded((prev) => ({ ...prev, review: result.review }));
      }
      setNotice(t("review.confirmed"));
      setReloadKey((k) => k + 1);
    } catch (caught) {
      setActionError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function handlePost() {
    setActionError(null);
    setNotice(null);
    setBusy("post");
    try {
      const result = await postDraft(token, ledgerId, draftId);
      setEntryId(result.entryId);
      setNotice(t("review.posted"));
      setReloadKey((k) => k + 1);
    } catch (caught) {
      setActionError(caught);
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell
      title={t("review.title")}
      subtitle={t("review.hint")}
      ledgerHref={`/ledgers/${ledgerId}/transactions`}
      actions={
        <Link href={`/ledgers/${ledgerId}/transactions`}>
          <Button variant="secondary" size="sm">
            {t("review.goToList")}
          </Button>
        </Link>
      }
    >
      {loading ? <LoadingBlock label={t("nav.loading")} /> : null}

      {error ? <ErrorMessage error={error} onRetry={retry} /> : null}

      {!loading && !error && review ? (
        <div className="flex flex-col gap-5">
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <KindBadge
                kind={draft?.kind ?? "EXPENSE"}
                label={draft?.kind === "INCOME" ? t("txn.income") : t("txn.expense")}
              />
              <StatusPill
                tone={
                  status === "POSTED"
                    ? "income"
                    : status === "CONFIRMED"
                      ? "warning"
                      : status === "REJECTED"
                        ? "expense"
                        : "neutral"
                }
              >
                {t(`txn.status.${status.toLowerCase()}` as MessageKey)}
              </StatusPill>
            </div>
            <Row
              label={t("txn.amount")}
              value={
                <span className="hesab-numeric" dir="ltr">
                  {formatAmount(review.amount, locale)} {review.currency ?? ""}
                </span>
              }
            />
            <Row label={t("txn.account")} value={review.account ?? "—"} />
            <Row
              label={t("txn.category")}
              value={
                <span className="inline-flex items-center gap-2">
                  <CategoryIcon
                    iconKey={selectedCategory?.iconKey}
                    className="size-4 shrink-0 text-ink-muted"
                  />
                  {review.category ?? "—"}
                </span>
              }
            />
            {review.categoryItem ? <Row label={t("txn.item")} value={review.categoryItem} /> : null}
            <Row label={t("txn.date")} value={formatDate(review.businessDate, locale)} />
            <Row
              label={t("txn.description")}
              value={review.description ?? t("txn.noDescription")}
            />
            {entryId ? <Row label={t("review.entryRef")} value={entryId} /> : null}
          </Card>

          {notice ? (
            <p
              role="status"
              className="rounded-lg border border-income/40 bg-income-soft px-4 py-3 text-sm text-income-ink"
            >
              {notice}
            </p>
          ) : null}

          {actionError ? <ErrorMessage error={actionError} /> : null}

          {editable ? (
            <Card>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("txn.amount")} htmlFor="edit-amount" required>
                  <TextInput
                    id="edit-amount"
                    inputMode="decimal"
                    dir="ltr"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <Field label={t("txn.date")} htmlFor="edit-businessDate" required>
                  <TextInput
                    id="edit-businessDate"
                    type="date"
                    dir="ltr"
                    value={businessDate}
                    onChange={(e) => setBusinessDate(e.target.value)}
                  />
                </Field>
                <Field label={t("txn.account")} htmlFor="edit-account" required>
                  <Select
                    id="edit-account"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  >
                    <option value="">—</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("txn.category")} htmlFor="edit-category" required>
                  <Select
                    id="edit-category"
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setCategoryItemId("");
                    }}
                  >
                    <option value="">—</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("txn.item")} htmlFor="edit-item">
                  <Select
                    id="edit-item"
                    value={categoryItemId}
                    onChange={(e) => setCategoryItemId(e.target.value)}
                    disabled={availableItems.length === 0}
                  >
                    <option value="">{t("common.none")}</option>
                    {availableItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t("txn.description")} htmlFor="edit-description">
                    <TextArea
                      id="edit-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="secondary" loading={busy === "save"} onClick={handleSave}>
                  {t("common.save")}
                </Button>
              </div>
            </Card>
          ) : (
            <p className="rounded-lg border border-line-strong bg-surface-overlay px-4 py-3 text-sm text-ink-secondary">
              {t("review.cannotEdit")}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {!mayConfirm ? (
              <p className="me-auto self-center text-xs text-ink-muted">{t("perm.noConfirm")}</p>
            ) : null}
            <Button
              variant="secondary"
              loading={busy === "confirm"}
              disabled={!mayConfirm || !editable}
              onClick={handleConfirm}
            >
              {busy === "confirm" ? t("review.confirming") : t("review.confirm")}
            </Button>
            {!mayPost ? (
              <p className="self-center text-xs text-ink-muted">{t("perm.noPost")}</p>
            ) : null}
            <Button
              loading={busy === "post"}
              disabled={!mayPost || status !== "CONFIRMED"}
              onClick={handlePost}
              title={status !== "CONFIRMED" ? t("review.postFirst") : undefined}
            >
              {busy === "post" ? t("review.posting") : t("review.post")}
            </Button>
          </div>

          {status === "CONFIRMED" && !mayPost ? (
            <p className="text-end text-xs text-ink-muted">{t("review.postFirst")}</p>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}