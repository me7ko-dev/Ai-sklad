"use client";

import { useEffect, useRef, useState } from "react";
import {
  createQuickProductAction,
  saveVoiceAction,
  type SavedLine,
} from "@/app/actions";
import type { VoiceResponse } from "@/app/api/glas/route";
import { KIND_LABELS, formatQty, type MovementKind } from "@/lib/format";
import { enqueue, newId, saveCatalog, type QueueItem } from "@/lib/offline-queue";

export type PickProduct = { id: string; name: string; unit: string; quantity: number };

type Draft = {
  key: string;
  kind: MovementKind;
  amount: string;
  said: string;
  productId: string | null;
  options: string[];
  question: string;
  newName: string;
  unit: string;
  choosing: boolean;
};

type State =
  | { step: "idle" }
  | { step: "recording"; seconds: number }
  | { step: "working" }
  | { step: "review"; transcript: string; reply: string; drafts: Draft[] }
  | { step: "saving"; transcript: string; reply: string; drafts: Draft[] }
  | { step: "saved"; lines: SavedLine[] }
  | { step: "queued"; lines: QueueItem[] }
  | { step: "error"; message: string };

const MAX_SECONDS = 60;
const NO_INTERNET =
  "Без интернет гласът не работи. Отворете продукта от списъка и запишете ръчно — ще се пази на телефона.";
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

const KIND_STYLE: Record<MovementKind, string> = {
  sale: "text-danger",
  delivery: "text-primary",
  adjustment: "text-blue-800",
};

function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

function parseAmount(value: string): number | null {
  const number = Number(value.trim().replace(",", "."));
  return value.trim() && Number.isFinite(number) && number >= 0 ? number : null;
}

function showAmount(value: number): string {
  return String(Math.round(value * 1000) / 1000).replace(".", ",");
}

function draftError(draft: Draft): string | null {
  if (!draft.productId) return "Изберете продукт";
  const amount = parseAmount(draft.amount);
  if (amount === null) return "Въведете количество";
  if (draft.kind !== "adjustment" && amount === 0) return "Количеството трябва да е повече от нула";
  return null;
}

export function VoiceAssistant({ products: fromServer }: { products: PickProduct[] }) {
  const [state, setState] = useState<State>({ step: "idle" });
  // Продукти, добавени оттук, докато сървърът още не ги е върнал в списъка.
  const [added, setAdded] = useState<PickProduct[]>([]);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Спира микрофона, ако човек напусне екрана по време на запис.
  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Пазим списъка на телефона, за да може да се работи и без интернет.
  useEffect(() => saveCatalog(fromServer), [fromServer]);

  const serverIds = new Set(fromServer.map((p) => p.id));
  const products = [...fromServer, ...added.filter((p) => !serverIds.has(p.id))];
  const byId = new Map(products.map((p) => [p.id, p]));
  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name, "bg"));

  async function send(body: FormData | string) {
    if (!navigator.onLine) {
      setState({ step: "error", message: NO_INTERNET });
      return;
    }
    setState({ step: "working" });
    try {
      const response = await fetch("/api/glas", {
        method: "POST",
        ...(typeof body === "string"
          ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ text: body }) }
          : { body }),
      });
      const data = (await response.json()) as VoiceResponse;
      if ("error" in data) {
        setState({ step: "error", message: data.error });
        return;
      }
      setState({
        step: "review",
        transcript: data.transcript,
        reply: data.reply,
        drafts: data.items.map((item, index) => ({
          key: `${Date.now()}-${index}`,
          kind: item.kind,
          amount: showAmount(item.amount),
          said: item.said,
          productId: item.product_id,
          options: item.options,
          question: item.question,
          newName: item.new_name,
          unit: item.unit,
          choosing: false,
        })),
      });
    } catch {
      setState({ step: "error", message: "Няма връзка със сървъра. Опитайте пак." });
    }
  }

  async function startRecording() {
    if (!navigator.onLine) {
      setState({ step: "error", message: NO_INTERNET });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState({
        step: "error",
        message: "Този телефон или браузър не позволява запис. Напишете текста вместо това.",
      });
      setTyping(true);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState({
        step: "error",
        message:
          "Няма достъп до микрофона. Разрешете микрофона за това приложение в настройките на телефона.",
      });
      return;
    }

    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const media = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    media.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    media.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      if (timer.current) clearInterval(timer.current);
      // Без „;codecs=…“ — услугата за разпознаване гледа само основния тип.
      const type = (media.mimeType || mimeType || "audio/webm").split(";")[0];
      const blob = new Blob(chunks, { type });
      if (blob.size < 1000) {
        setState({ step: "error", message: "Записът е твърде кратък. Натиснете и говорете." });
        return;
      }
      const form = new FormData();
      form.append("audio", blob, `zapis.${extensionFor(type)}`);
      void send(form);
    };

    recorder.current = media;
    media.start();
    setState({ step: "recording", seconds: 0 });
    const startedAt = Date.now();
    timer.current = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      if (seconds >= MAX_SECONDS) stopRecording();
      else setState({ step: "recording", seconds });
    }, 250);
  }

  function stopRecording() {
    if (timer.current) clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function updateDraft(key: string, change: Partial<Draft>) {
    setState((current) =>
      current.step === "review"
        ? {
            ...current,
            drafts: current.drafts.map((draft) => (draft.key === key ? { ...draft, ...change } : draft)),
          }
        : current,
    );
  }

  function removeDraft(key: string) {
    setState((current) =>
      current.step === "review"
        ? { ...current, drafts: current.drafts.filter((draft) => draft.key !== key) }
        : current,
    );
  }

  async function addProduct(draft: Draft) {
    const result = await createQuickProductAction(draft.newName, draft.unit);
    if ("error" in result) {
      alert(result.error);
      return;
    }
    setAdded((current) => [...current, result.product]);
    updateDraft(draft.key, { productId: result.product.id, newName: "", unit: result.product.unit });
  }

  async function save() {
    if (state.step !== "review") return;
    const at = new Date().toISOString();
    const items = state.drafts.map((draft) => {
      const product = byId.get(draft.productId!);
      return {
        client_id: newId(),
        product_id: draft.productId!,
        name: product?.name ?? draft.newName,
        unit: product?.unit ?? draft.unit,
        kind: draft.kind,
        amount: parseAmount(draft.amount)!,
        at,
        source: "voice" as const,
        note: state.transcript || null,
      };
    });

    // Връзката е изчезнала след разпознаването — пазим на телефона.
    function saveOffline() {
      if (enqueue(items)) {
        setState({ step: "queued", lines: items });
      } else {
        setState({ ...state, step: "review" } as State);
        alert("Няма интернет и телефонът не можа да запази записа. Опитайте пак.");
      }
    }

    if (!navigator.onLine) {
      saveOffline();
      return;
    }
    setState({ ...state, step: "saving" });
    let result;
    try {
      result = await saveVoiceAction(
        items.map(({ product_id, kind, amount, client_id }) => ({ product_id, kind, amount, client_id })),
        state.transcript,
      );
    } catch {
      saveOffline();
      return;
    }

    if ("error" in result) {
      setState({ ...state, step: "review" });
      alert(result.error);
      return;
    }
    setState({ step: "saved", lines: result.saved });
  }

  function reset() {
    setState({ step: "idle" });
    setText("");
  }

  // Преглед и потвърждение на разбраното.
  if (state.step === "review" || state.step === "saving") {
    const ready = state.drafts.length > 0 && state.drafts.every((draft) => !draftError(draft));
    return (
      <section className="card flex flex-col gap-4" aria-live="polite">
        {state.transcript && (
          <p className="text-xl">
            <span className="text-muted">Чух: </span>„{state.transcript}“
          </p>
        )}
        {state.drafts.length === 0 && (
          <p className="alert-error">{state.reply || "Не разбрах какво да запиша."}</p>
        )}

        {state.drafts.map((draft) => {
          const product = draft.productId ? byId.get(draft.productId) : undefined;
          const error = draftError(draft);
          return (
            <article key={draft.key} className="flex flex-col gap-3 rounded-2xl border-2 border-border p-3">
              <select
                aria-label="Вид промяна"
                value={draft.kind}
                onChange={(event) => updateDraft(draft.key, { kind: event.target.value as MovementKind })}
                className={`field text-2xl font-bold ${KIND_STYLE[draft.kind]}`}
              >
                {(Object.keys(KIND_LABELS) as MovementKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABELS[kind]}
                  </option>
                ))}
              </select>

              {draft.said && <p className="text-lg text-muted">„{draft.said}“</p>}

              {draft.question && (
                <p className="rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-xl font-semibold text-amber-900">
                  ❓ {draft.question}
                </p>
              )}

              {product && !draft.choosing ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-2xl font-bold">
                    {product.name}
                    <span className="block text-lg font-normal text-muted">
                      сега има {formatQty(product.quantity)} {product.unit}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => updateDraft(draft.key, { choosing: true })}
                    className="min-h-12 shrink-0 px-2 text-lg text-primary underline"
                  >
                    Смени
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {draft.options.length > 0 && !draft.choosing && (
                    <div className="flex flex-col gap-2">
                      {draft.options.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => updateDraft(draft.key, { productId: id, question: "", options: [] })}
                          className="btn btn-secondary"
                        >
                          {byId.get(id)?.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {draft.newName && !draft.choosing && (
                    <>
                      <p className="text-xl">
                        Няма „<b>{draft.newName}</b>“ в склада.
                      </p>
                      <button type="button" onClick={() => addProduct(draft)} className="btn btn-secondary">
                        + Добави „{draft.newName}“
                      </button>
                    </>
                  )}
                  <select
                    aria-label="Изберете продукт"
                    value={draft.productId ?? ""}
                    onChange={(event) =>
                      updateDraft(draft.key, {
                        productId: event.target.value || null,
                        choosing: false,
                        options: [],
                        question: "",
                      })
                    }
                    className="field text-xl"
                  >
                    <option value="">
                      {draft.options.length || draft.newName ? "— друг продукт —" : "— изберете продукт —"}
                    </option>
                    {sorted.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  aria-label="Едно по-малко"
                  onClick={() =>
                    updateDraft(draft.key, {
                      amount: showAmount(Math.max(0, (parseAmount(draft.amount) ?? 0) - 1)),
                    })
                  }
                  className="btn btn-secondary w-16 shrink-0 px-0 text-4xl"
                >
                  −
                </button>
                <input
                  aria-label="Количество"
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(event) => updateDraft(draft.key, { amount: event.target.value })}
                  className="field min-w-0 flex-1 text-center text-3xl font-bold"
                />
                <button
                  type="button"
                  aria-label="Едно повече"
                  onClick={() =>
                    updateDraft(draft.key, { amount: showAmount((parseAmount(draft.amount) ?? 0) + 1) })
                  }
                  className="btn btn-secondary w-16 shrink-0 px-0 text-4xl"
                >
                  +
                </button>
              </div>
              <p className="text-center text-lg text-muted">
                {product?.unit ?? draft.unit}
                {draft.kind === "adjustment" ? " — точно толкова има сега" : ""}
              </p>

              {error && <p className="text-lg font-semibold text-danger">⚠ {error}</p>}

              <button
                type="button"
                onClick={() => removeDraft(draft.key)}
                className="min-h-12 self-start text-lg text-muted underline"
              >
                Махни този ред
              </button>
            </article>
          );
        })}

        {state.drafts.length > 0 && (
          <button
            type="button"
            onClick={save}
            disabled={!ready || state.step === "saving"}
            className="btn btn-primary"
          >
            {state.step === "saving" ? "Записвам…" : "✓ Да, запиши"}
          </button>
        )}
        <button type="button" onClick={reset} disabled={state.step === "saving"} className="btn btn-secondary">
          {state.drafts.length > 0 ? "✗ Откажи" : "Опитай пак"}
        </button>
      </section>
    );
  }

  if (state.step === "saved") {
    return (
      <section className="card flex flex-col gap-4" aria-live="polite">
        <p className="alert-success text-2xl">✓ Записано</p>
        <ul className="flex flex-col gap-2">
          {state.lines.map((line, index) => (
            <li key={index} className={`text-xl ${line.low ? "font-bold text-danger" : ""}`}>
              {line.name}: {KIND_LABELS[line.kind].toLowerCase()}{" "}
              {line.kind === "adjustment" ? "" : line.kind === "sale" ? "−" : "+"}
              {line.kind === "adjustment" ? "" : formatQty(line.amount)} → има {formatQty(line.quantity)}{" "}
              {line.unit}
              {line.low ? " ⚠ свършва" : ""}
            </li>
          ))}
        </ul>
        <button type="button" onClick={reset} className="btn btn-primary">
          🎤 Нов запис
        </button>
      </section>
    );
  }

  if (state.step === "queued") {
    return (
      <section className="card flex flex-col gap-4" aria-live="polite">
        <p className="rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-xl font-semibold text-amber-900">
          Интернетът изчезна — записано на телефона. Ще се изпрати само, когато има връзка.
        </p>
        <ul className="flex flex-col gap-2">
          {state.lines.map((line) => (
            <li key={line.client_id} className="text-xl">
              {line.name}: {KIND_LABELS[line.kind].toLowerCase()} {formatQty(line.amount)} {line.unit}
            </li>
          ))}
        </ul>
        <button type="button" onClick={reset} className="btn btn-primary">
          🎤 Нов запис
        </button>
      </section>
    );
  }

  const recording = state.step === "recording";
  const working = state.step === "working";

  return (
    <section className="card flex flex-col items-center gap-4 py-6" aria-live="polite">
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        disabled={working}
        aria-label={recording ? "Спри записа" : "Натиснете и говорете"}
        className={`flex h-44 w-44 flex-col items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 disabled:opacity-60 ${
          recording ? "animate-pulse bg-danger" : "bg-primary"
        }`}
      >
        {recording ? (
          <span className="h-14 w-14 rounded-lg bg-white" aria-hidden />
        ) : (
          <svg viewBox="0 0 24 24" className="h-20 w-20" fill="currentColor" aria-hidden>
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
          </svg>
        )}
      </button>

      <p className="text-center text-2xl font-bold">
        {recording
          ? `Говорете… ${state.seconds} сек.`
          : working
            ? "Слушам и разбирам…"
            : "Натиснете и говорете"}
      </p>
      <p className="text-center text-lg text-muted">
        {recording
          ? "Натиснете пак, когато свършите."
          : "Например: „продадох три хляба и две олиа“"}
      </p>

      {state.step === "error" && (
        <p role="alert" className="alert-error w-full">
          {state.message}
        </p>
      )}

      {!recording && !working && (
        <>
          {typing ? (
            <form
              className="flex w-full flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (text.trim()) void send(text.trim());
              }}
            >
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Напишете какво стана…"
                aria-label="Напишете какво стана"
                className="field py-3"
              />
              <button type="submit" disabled={!text.trim()} className="btn btn-secondary">
                Разбери
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setTyping(true)}
              className="min-h-12 text-lg text-primary underline"
            >
              или напишете с текст
            </button>
          )}
        </>
      )}
    </section>
  );
}
