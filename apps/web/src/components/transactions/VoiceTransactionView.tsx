"use client";

import Link from "next/link";
import { useMemo, useReducer, useState, type ChangeEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, EmptyState, ErrorMessage, LoadingBlock } from "@/components/Feedback";
import { Field, Select, TextArea, TextInput } from "@/components/Form";
import { useLocale, useTranslations } from "@/components/LocaleProvider";
import { useSession } from "@/components/SessionProvider";
import {
  can,
  confirmVoiceCard,
  parseVoice,
  transcribeVoice,
  type ConfirmVoiceCardInput,
  type VoiceCard,
} from "@/lib/api-client";
import { selectableItems, useLedgerContext } from "@/hooks/useLedgerContext";
import { useAudioRecorder, type RecordedAudio } from "@/hooks/useAudioRecorder";

const KIND_OPTIONS: { value: string; ar: string; en: string }[] = [
  { value: "INCOME", ar: "وارد", en: "Income" },
  { value: "EXPENSE", ar: "صادر", en: "Expense" },
  { value: "SALE_CASH", ar: "بيع نقدي", en: "Cash sale" },
  { value: "SALE_CREDIT", ar: "بيع آجل", en: "Credit sale" },
  { value: "PURCHASE_CASH", ar: "شراء نقدي", en: "Cash purchase" },
  { value: "PURCHASE_CREDIT", ar: "شراء آجل", en: "Credit purchase" },
  { value: "COLLECTION", ar: "تحصيل", en: "Collection" },
  { value: "PAYMENT", ar: "دفع", en: "Payment" },
];

const MISSING_LABEL_KEYS: Record<string, string> = {
  kind: "voice.kind",
  amount: "voice.amount",
  currency: "voice.currency",
  account: "voice.account",
  category: "voice.category",
  contact: "voice.contact",
  quantity: "voice.quantity",
};

function isPositiveDecimal(value: string): boolean {
  if (!/^\d+(\.\d+)?$/.test(value)) return false;
  return !/^0+(\.0+)?$/.test(value);
}

type CardForm = {
  kind: string;
  amount: string;
  currencyCode: string;
  financialAccountId: string;
  categoryId: string;
  categoryItemId: string;
  contactId: string;
  productId: string;
  quantity: string;
  businessDate: string;
  description: string;
};

const EMPTY_FORM: CardForm = {
  kind: "",
  amount: "",
  currencyCode: "",
  financialAccountId: "",
  categoryId: "",
  categoryItemId: "",
  contactId: "",
  productId: "",
  quantity: "",
  businessDate: "",
  description: "",
};

function formFromCard(card: VoiceCard, fallbackCurrency: string): CardForm {
  return {
    kind: card.kind ?? "",
    amount: card.amount ?? "",
    currencyCode: card.currencyCode ?? fallbackCurrency,
    financialAccountId: card.financialAccountId ?? "",
    categoryId: card.categoryId ?? "",
    categoryItemId: card.categoryItemId ?? "",
    contactId: card.contactId ?? "",
    productId: card.productId ?? "",
    quantity: card.quantity ?? "",
    businessDate: card.businessDate ?? "",
    description: card.description ?? "",
  };
}

/**
 * The voice pipeline as an explicit, typed state machine:
 * idle → recording → recorded → transcribing → transcribed → parsing → review
 * → confirming → created, with any failure landing in `error` (a `BACK` action
 * returns to the step derived from the data already collected).
 */
type VoicePhase =
  | "idle"
  | "recording"
  | "recorded"
  | "transcribing"
  | "transcribed"
  | "parsing"
  | "review"
  | "confirming"
  | "created"
  | "error";

type VoiceAudio = { blob: Blob; filename: string; source: "recording" | "upload" };

type VoiceState = {
  phase: VoicePhase;
  audio: VoiceAudio | null;
  transcript: string;
  card: VoiceCard | null;
  form: CardForm;
  draftId: string | null;
  error: unknown;
};

type VoiceAction =
  | { type: "START_RECORDING" }
  | { type: "STOP_RECORDING"; audio: VoiceAudio }
  | { type: "SELECT_FILE"; audio: VoiceAudio }
  | { type: "TRANSCRIBE_START" }
  | { type: "TRANSCRIBE_SUCCESS"; transcript: string }
  | { type: "EDIT_TRANSCRIPT"; transcript: string }
  | { type: "PARSE_START" }
  | { type: "PARSE_SUCCESS"; card: VoiceCard; baseCurrency: string }
  | { type: "EDIT_FORM"; form: CardForm }
  | { type: "CONFIRM_START" }
  | { type: "CONFIRM_SUCCESS"; draftId: string }
  | { type: "FAIL"; error: unknown }
  | { type: "BACK" }
  | { type: "RESET" };

const INITIAL_STATE: VoiceState = {
  phase: "idle",
  audio: null,
  transcript: "",
  card: null,
  form: EMPTY_FORM,
  draftId: null,
  error: null,
};

/** The step to return to when leaving `error`, inferred from collected data. */
function previousPhase(state: VoiceState): VoicePhase {
  if (state.card) return "review";
  if (state.transcript.trim() !== "") return "transcribed";
  if (state.audio) return "recorded";
  return "idle";
}

function reducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case "START_RECORDING":
      return {
        ...INITIAL_STATE,
        phase: "recording",
      };
    case "STOP_RECORDING":
      if (state.phase !== "recording") return state;
      return { ...state, phase: "recorded", audio: action.audio };
    case "SELECT_FILE":
      if (state.phase === "recording") return state;
      return { ...INITIAL_STATE, phase: "recorded", audio: action.audio };
    case "TRANSCRIBE_START":
      if (state.phase !== "recorded") return state;
      return { ...state, phase: "transcribing", error: null };
    case "TRANSCRIBE_SUCCESS":
      if (state.phase !== "transcribing") return state;
      return { ...state, phase: "transcribed", transcript: action.transcript };
    case "EDIT_TRANSCRIPT":
      if (state.phase !== "transcribed") return state;
      return { ...state, transcript: action.transcript, card: null };
    case "PARSE_START":
      if (state.phase !== "transcribed") return state;
      return { ...state, phase: "parsing", error: null };
    case "PARSE_SUCCESS":
      if (state.phase !== "parsing") return state;
      return {
        ...state,
        phase: "review",
        card: action.card,
        form: formFromCard(action.card, action.baseCurrency),
      };
    case "EDIT_FORM":
      if (state.phase !== "review") return state;
      return { ...state, form: action.form };
    case "CONFIRM_START":
      if (state.phase !== "review") return state;
      return { ...state, phase: "confirming", error: null };
    case "CONFIRM_SUCCESS":
      if (state.phase !== "confirming") return state;
      return { ...state, phase: "created", draftId: action.draftId };
    case "FAIL":
      return { ...state, phase: "error", error: action.error };
    case "BACK":
      if (state.phase !== "error") return state;
      return { ...state, phase: previousPhase(state), error: null };
    case "RESET":
      return { ...INITIAL_STATE };
    default:
      return state;
  }
}

export function VoiceTransactionView({
  ledgerId,
  embedded = false,
  onDraftCreated,
}: {
  ledgerId: string;
  /** When true, the view renders without `AppShell` so a page can host it inline. */
  embedded?: boolean;
  /** When provided, a successful confirm resets the view and reports the new draft. */
  onDraftCreated?: (draftId: string) => void;
}) {
  const t = useTranslations();
  const { locale } = useLocale();
  const { token } = useSession();
  const { accounts, categories, ledger, permissions, loading, error, reload } = useLedgerContext(
    token,
    ledgerId,
  );

  const baseCurrency = ledger?.baseCurrency?.code ?? "";

  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [recordingError, setRecordingError] = useState<unknown>(null);

  const recorder = useAudioRecorder({
    onComplete: (audio: RecordedAudio) =>
      dispatch({
        type: "STOP_RECORDING",
        audio: { blob: audio.blob, filename: audio.filename, source: "recording" },
      }),
    onError: (caught) => {
      setRecordingError(caught);
      dispatch({ type: "FAIL", error: caught });
    },
  });

  const phase = state.phase;
  const busy = phase === "transcribing" || phase === "parsing" || phase === "confirming";
  const mayCreate = can(permissions, "create");

  const selectedCategory = categories.find((c) => c.id === state.form.categoryId) ?? null;
  const availableItems = useMemo(() => selectableItems(selectedCategory), [selectedCategory]);

  const needsContact =
    state.form.kind === "SALE_CREDIT" || state.form.kind === "COLLECTION";
  const contactRequired =
    needsContact || state.form.kind === "PURCHASE_CREDIT" || state.form.kind === "PAYMENT";

  const complete =
    state.form.kind !== "" &&
    isPositiveDecimal(state.form.amount) &&
    state.form.currencyCode.trim() !== "" &&
    state.form.financialAccountId !== "" &&
    state.form.categoryId !== "" &&
    (!contactRequired || state.form.contactId !== "") &&
    !(state.form.productId !== "" && state.form.quantity.trim() === "");

  const allMissing = state.card ? state.card.missingFields : [];
  const showTranscript =
    phase !== "created" && (phase === "transcribed" || phase === "parsing" || state.transcript.trim() !== "");
  const showReview = phase !== "created" && state.card !== null;
  const hasRecording = state.audio?.source === "recording";

  async function handleStartRecording() {
    setRecordingError(null);
    try {
      await recorder.start();
      dispatch({ type: "START_RECORDING" });
    } catch (caught) {
      setRecordingError(caught);
      dispatch({ type: "FAIL", error: caught });
    }
  }

  function handleStopRecording() {
    recorder.stop();
  }

  function handleSelectFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    if (!next) return;
    setRecordingError(null);
    dispatch({
      type: "SELECT_FILE",
      audio: { blob: next, filename: next.name, source: "upload" },
    });
    event.target.value = "";
  }

  async function handleTranscribe() {
    if (!state.audio) return;
    dispatch({ type: "TRANSCRIBE_START" });
    try {
      const result = await transcribeVoice(token, ledgerId, state.audio.blob, state.audio.filename);
      dispatch({ type: "TRANSCRIBE_SUCCESS", transcript: result.text });
    } catch (caught) {
      dispatch({ type: "FAIL", error: caught });
    }
  }

  async function handleParse() {
    const text = state.transcript.trim();
    if (!text) return;
    dispatch({ type: "PARSE_START" });
    try {
      const { card } = await parseVoice(token, ledgerId, { text });
      dispatch({ type: "PARSE_SUCCESS", card, baseCurrency });
    } catch (caught) {
      dispatch({ type: "FAIL", error: caught });
    }
  }

  async function handleConfirm() {
    if (!complete || !state.card) return;
    dispatch({ type: "CONFIRM_START" });
    const payload: ConfirmVoiceCardInput = {
      kind: state.form.kind,
      amount: state.form.amount.trim(),
      currencyCode: state.form.currencyCode.trim(),
      financialAccountId: state.form.financialAccountId,
      categoryId: state.form.categoryId,
    };
    if (state.form.categoryItemId) payload.categoryItemId = state.form.categoryItemId;
    if (state.form.contactId) payload.contactId = state.form.contactId;
    if (state.form.productId) payload.productId = state.form.productId;
    if (state.form.quantity.trim()) payload.quantity = state.form.quantity.trim();
    if (state.form.businessDate) payload.businessDate = state.form.businessDate;
    if (state.form.description.trim()) payload.description = state.form.description.trim();

    try {
      const result = await confirmVoiceCard(token, ledgerId, payload);
      if (onDraftCreated) {
        dispatch({ type: "RESET" });
        onDraftCreated(result.draft.id);
      } else {
        dispatch({ type: "CONFIRM_SUCCESS", draftId: result.draft.id });
      }
    } catch (caught) {
      dispatch({ type: "FAIL", error: caught });
    }
  }

  if (loading) {
    if (embedded) return <LoadingBlock label={t("nav.loading")} />;
    return (
      <AppShell title={t("voice.title")} ledgerHref="/ledgers">
        <LoadingBlock label={t("nav.loading")} />
      </AppShell>
    );
  }

  const body = (
    <>
      {error ? <ErrorMessage error={error} onRetry={reload} /> : null}

      {!mayCreate ? (
        <Card className="mb-4 border-warning/40 bg-warning-soft">
          <p className="text-sm text-warning-ink">{t("perm.noCreate")}</p>
        </Card>
      ) : null}

      {phase === "error" ? (
        <Card className="mb-4 border-expense/40 bg-expense-soft">
          {recordingError ? (
            <p role="alert" className="text-sm text-expense-ink">
              {t("voice.micError")}
            </p>
          ) : (
            <ErrorMessage error={state.error} />
          )}
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={() => dispatch({ type: "BACK" })}>
              {t("common.back")}
            </Button>
          </div>
        </Card>
      ) : null}

      {phase === "created" && state.draftId ? (
        <Card className="mb-4 border-income/40 bg-income-soft">
          <p className="text-sm text-income-ink">{t("voice.confirmed")}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href={`/ledgers/${ledgerId}/transactions/${state.draftId}`}>
              <Button variant="secondary" size="sm">
                {t("voice.viewDraft")}
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "RESET" })}>
              {t("voice.startOver")}
            </Button>
          </div>
        </Card>
      ) : null}

      {phase !== "created" ? (
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink-secondary">
              {t("voice.uploadHeading")}
            </h2>

            {recorder.supported ? (
              <div className="flex flex-wrap items-center gap-3">
                {phase === "recording" ? (
                  <Button type="button" variant="danger" onClick={handleStopRecording}>
                    {t("voice.stop")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => void handleStartRecording()}
                    disabled={!mayCreate || busy}
                  >
                    {t("voice.record")}
                  </Button>
                )}
                {phase === "recording" ? (
                  <span role="status" className="text-xs text-expense-ink">
                    {t("voice.recording")}
                  </span>
                ) : null}
                {hasRecording && phase !== "recording" ? (
                  <>
                    <span className="text-xs text-ink-muted">{t("voice.recorded")}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleStartRecording()}
                      disabled={!mayCreate || busy}
                    >
                      {t("voice.recordAgain")}
                    </Button>
                  </>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-ink-muted">{t("voice.recordingUnsupported")}</p>
            )}

            {recordingError ? (
              <p role="alert" className="mt-2 text-xs text-expense-ink">
                {t("voice.micError")}
              </p>
            ) : null}

            <div className="mt-4 border-t border-line-subtle pt-4">
              <p className="mb-2 text-xs text-ink-muted">{t("voice.uploadAlternative")}</p>
              <Field label={t("voice.chooseFile")} htmlFor="voiceFile">
                <input
                  id="voiceFile"
                  name="voiceFile"
                  type="file"
                  accept=".m4a,.mp3,.ogg,.oga,.opus,.wav,.webm,.aac,audio/*"
                  onChange={handleSelectFile}
                  disabled={phase === "recording" || busy}
                  className="block text-sm text-ink-secondary"
                />
              </Field>
              <p className="mt-2 text-xs text-ink-muted">
                {state.audio ? `${t("voice.selectedFile")}: ${state.audio.filename}` : t("voice.noFile")}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => void handleTranscribe()}
                loading={phase === "transcribing"}
                disabled={!state.audio || !mayCreate || phase === "recording" || busy}
              >
                {phase === "transcribing" ? t("voice.starting") : t("voice.start")}
              </Button>
              {state.audio && phase !== "recording" && phase !== "transcribing" ? (
                <span className="text-xs text-ink-muted">{t("voice.audioReady")}</span>
              ) : null}
            </div>

            <p className="mt-2 text-xs text-ink-muted">{t("voice.privacyNote")}</p>
          </Card>

          {showTranscript ? (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-ink-secondary">
                {t("voice.transcriptHeading")}
              </h2>
              <Field
                label={t("voice.transcriptHeading")}
                htmlFor="voiceTranscript"
                hint={t("voice.transcriptHint")}
              >
                <TextArea
                  id="voiceTranscript"
                  name="voiceTranscript"
                  value={state.transcript}
                  onChange={(e) => dispatch({ type: "EDIT_TRANSCRIPT", transcript: e.target.value })}
                  disabled={phase === "parsing"}
                  dir="rtl"
                />
              </Field>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  onClick={() => void handleParse()}
                  loading={phase === "parsing"}
                  disabled={state.transcript.trim() === "" || !mayCreate || busy}
                >
                  {phase === "parsing" ? t("voice.parsing") : t("voice.parse")}
                </Button>
              </div>
              {state.transcript.trim() === "" && !state.card ? (
                <p className="mt-2 text-xs text-ink-muted">{t("voice.emptyTranscript")}</p>
              ) : null}
            </Card>
          ) : null}

          {showReview ? (
            <Card>
              <h2 className="mb-1 text-sm font-semibold text-ink-secondary">
                {t("voice.reviewHeading")}
              </h2>
              <p className="mb-4 text-xs text-ink-muted">{t("voice.reviewHint")}</p>

              {allMissing.length > 0 ? (
                <div className="mb-4 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3">
                  <p className="text-xs font-medium text-warning-ink">{t("voice.missingHeading")}</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-warning-ink">
                    {allMissing.map((field) => (
                      <li key={field}>
                        {field in MISSING_LABEL_KEYS
                          ? t(MISSING_LABEL_KEYS[field] as Parameters<typeof t>[0])
                          : field}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {state.card && state.card.warnings.length > 0 ? (
                <div className="mb-4 rounded-lg border border-line-strong bg-surface-overlay px-4 py-3">
                  <p className="text-xs font-medium text-ink-secondary">
                    {t("voice.warningsHeading")}
                  </p>
                  <ul className="mt-1 list-inside list-disc text-xs text-ink-muted">
                    {state.card.warnings.map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("voice.kind")} htmlFor="voiceKind" required>
                  <Select
                    id="voiceKind"
                    name="voiceKind"
                    value={state.form.kind}
                    onChange={(e) =>
                      dispatch({ type: "EDIT_FORM", form: { ...state.form, kind: e.target.value } })
                    }
                  >
                    <option value="">—</option>
                    {KIND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {locale === "ar" ? option.ar : option.en}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label={t("voice.amount")} htmlFor="voiceAmount" required>
                  <TextInput
                    id="voiceAmount"
                    name="voiceAmount"
                    inputMode="decimal"
                    dir="ltr"
                    value={state.form.amount}
                    onChange={(e) =>
                      dispatch({ type: "EDIT_FORM", form: { ...state.form, amount: e.target.value } })
                    }
                  />
                </Field>

                <Field label={t("voice.currency")} htmlFor="voiceCurrency" required>
                  <TextInput
                    id="voiceCurrency"
                    name="voiceCurrency"
                    dir="ltr"
                    value={state.form.currencyCode}
                    onChange={(e) =>
                      dispatch({
                        type: "EDIT_FORM",
                        form: { ...state.form, currencyCode: e.target.value },
                      })
                    }
                  />
                </Field>

                <Field label={t("voice.date")} htmlFor="voiceDate">
                  <TextInput
                    id="voiceDate"
                    name="voiceDate"
                    type="date"
                    dir="ltr"
                    value={state.form.businessDate}
                    onChange={(e) =>
                      dispatch({
                        type: "EDIT_FORM",
                        form: { ...state.form, businessDate: e.target.value },
                      })
                    }
                  />
                </Field>

                <Field label={t("voice.account")} htmlFor="voiceAccount" required>
                  <Select
                    id="voiceAccount"
                    name="voiceAccount"
                    value={state.form.financialAccountId}
                    onChange={(e) =>
                      dispatch({
                        type: "EDIT_FORM",
                        form: { ...state.form, financialAccountId: e.target.value },
                      })
                    }
                    disabled={accounts.length === 0}
                  >
                    <option value="">—</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label={t("voice.category")} htmlFor="voiceCategory" required>
                  <Select
                    id="voiceCategory"
                    name="voiceCategory"
                    value={state.form.categoryId}
                    onChange={(e) =>
                      dispatch({
                        type: "EDIT_FORM",
                        form: { ...state.form, categoryId: e.target.value, categoryItemId: "" },
                      })
                    }
                    disabled={categories.length === 0}
                  >
                    <option value="">—</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                {availableItems.length > 0 ? (
                  <Field label={t("txn.item")} htmlFor="voiceItem">
                    <Select
                      id="voiceItem"
                      name="voiceItem"
                      value={state.form.categoryItemId}
                      onChange={(e) =>
                        dispatch({
                          type: "EDIT_FORM",
                          form: { ...state.form, categoryItemId: e.target.value },
                        })
                      }
                    >
                      <option value="">{t("common.none")}</option>
                      {availableItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}

                {state.card?.productId ? (
                  <>
                    <Field label={t("voice.product")} htmlFor="voiceProduct">
                      <TextInput
                        id="voiceProduct"
                        name="voiceProduct"
                        readOnly
                        value={state.card.productName ?? ""}
                      />
                    </Field>
                    <Field label={t("voice.quantity")} htmlFor="voiceQuantity" required>
                      <TextInput
                        id="voiceQuantity"
                        name="voiceQuantity"
                        inputMode="decimal"
                        dir="ltr"
                        value={state.form.quantity}
                        onChange={(e) =>
                          dispatch({
                            type: "EDIT_FORM",
                            form: { ...state.form, quantity: e.target.value },
                          })
                        }
                      />
                    </Field>
                  </>
                ) : null}

                {contactRequired ? (
                  <Field label={t("voice.contact")} htmlFor="voiceContact" required>
                    <TextInput
                      id="voiceContact"
                      name="voiceContact"
                      readOnly
                      value={state.card?.contactName ?? ""}
                    />
                  </Field>
                ) : null}

                <Field label={t("txn.description")} htmlFor="voiceDescription">
                  <TextArea
                    id="voiceDescription"
                    name="voiceDescription"
                    value={state.form.description}
                    onChange={(e) =>
                      dispatch({
                        type: "EDIT_FORM",
                        form: { ...state.form, description: e.target.value },
                      })
                    }
                  />
                </Field>
              </div>

              {!complete ? (
                <p className="mt-4 text-xs text-warning-ink">{t("voice.notConfirmable")}</p>
              ) : null}

              <div className="mt-5 flex justify-end">
                <Button
                  type="button"
                  onClick={() => void handleConfirm()}
                  loading={phase === "confirming"}
                  disabled={!complete || !mayCreate}
                >
                  {phase === "confirming" ? t("voice.confirming") : t("voice.confirm")}
                </Button>
              </div>
            </Card>
          ) : (
            <EmptyState message={t("voice.transcriptHint")} />
          )}
        </div>
      ) : null}
    </>
  );

  if (embedded) return body;

  return (
    <AppShell
      title={t("voice.title")}
      subtitle={t("voice.subtitle")}
      ledgerHref={`/ledgers/${ledgerId}/transactions`}
      actions={
        <Link href={`/ledgers/${ledgerId}/transactions`}>
          <Button variant="secondary" size="sm">
            {t("common.back")}
          </Button>
        </Link>
      }
    >
      {body}
    </AppShell>
  );
}
