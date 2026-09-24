"use client";

import { useActionState, useState } from "react";
import { recordMovementAction, type FormState } from "@/app/actions";
import { formatQty, parseQty, type MovementKind } from "@/lib/format";
import { enqueue, newId } from "@/lib/offline-queue";

const SAVED_OFFLINE = "Няма интернет — записано на телефона. Ще се изпрати само, когато има връзка.";

const OPTIONS: { kind: MovementKind; label: string; hint: string }[] = [
  { kind: "sale", label: "Продадох", hint: "Колко продадохте?" },
  { kind: "delivery", label: "Доставка", hint: "Колко дойдоха?" },
  { kind: "adjustment", label: "Преброих", hint: "Колко има точно сега?" },
];

function parse(value: string): number {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

export function MovementForm({
  productId,
  name,
  unit,
  quantity,
}: {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
}) {
  // Без интернет записът остава на телефона със същия номер,
  // така че няма да се запише два пъти, ако сървърът все пак го е получил.
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (previous, formData) => {
    const clientId = newId();
    formData.set("client_id", clientId);
    const kind = formData.get("kind") as MovementKind;
    const amount = parseQty(formData.get("amount"));

    function saveOffline(): FormState {
      if (amount === null || (kind !== "adjustment" && amount === 0)) {
        return { error: "Въведете количество." };
      }
      const saved = enqueue([
        {
          client_id: clientId,
          product_id: productId,
          name,
          unit,
          kind,
          amount,
          at: new Date().toISOString(),
          source: "manual",
          note: null,
        },
      ]);
      return saved ? { success: SAVED_OFFLINE } : { error: "Няма интернет и телефонът не можа да запази записа." };
    }

    if (!navigator.onLine) return saveOffline();
    try {
      return await recordMovementAction(previous, formData);
    } catch {
      return saveOffline();
    }
  }, {});
  const [kind, setKind] = useState<MovementKind>("sale");
  const [amount, setAmount] = useState("1");
  const current = OPTIONS.find((option) => option.kind === kind)!;

  function choose(next: MovementKind) {
    setKind(next);
    setAmount(next === "adjustment" ? formatQty(Math.max(quantity, 0)).replace(/\s/g, "") : "1");
  }

  function step(delta: number) {
    const next = Math.max(0, Math.round((parse(amount) + delta) * 1000) / 1000);
    setAmount(String(next).replace(".", ","));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={productId} />
      <input type="hidden" name="kind" value={kind} />

      <div className="grid grid-cols-1 gap-3" role="radiogroup" aria-label="Какво се случи">
        {OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            role="radio"
            aria-checked={kind === option.kind}
            onClick={() => choose(option.kind)}
            className={`btn ${kind === option.kind ? "btn-primary" : "btn-secondary"}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label htmlFor="amount" className="label mt-2">
        {current.hint} <span className="font-normal text-muted">({unit})</span>
      </label>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Едно по-малко"
          className="btn btn-secondary w-16 shrink-0 px-0 text-4xl"
        >
          −
        </button>
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="field min-w-0 flex-1 text-center text-4xl font-bold"
        />
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Едно повече"
          className="btn btn-secondary w-16 shrink-0 px-0 text-4xl"
        >
          +
        </button>
      </div>

      {state.error && (
        <p role="alert" className="alert-error">
          {state.error}
        </p>
      )}
      {state.success && !pending && (
        <p role="status" className="alert-success">
          {state.success}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary mt-2">
        {pending ? "Записвам…" : "Запиши"}
      </button>
    </form>
  );
}
