"use client";

import { useState, useSyncExternalStore } from "react";
import { KIND_LABELS, formatDateTime, formatQty, parseQty, type MovementKind } from "@/lib/format";
import {
  enqueue,
  estimateQuantity,
  newId,
  useCatalog,
  useQueue,
  type CachedProduct,
} from "@/lib/offline-queue";

const OPTIONS: { kind: MovementKind; label: string; hint: string }[] = [
  { kind: "sale", label: "Продадох", hint: "Колко продадохте?" },
  { kind: "delivery", label: "Доставка", hint: "Колко дойдоха?" },
  { kind: "adjustment", label: "Преброих", hint: "Колко има точно сега?" },
];

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function OfflineApp() {
  const catalog = useCatalog();
  const queue = useQueue();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CachedProduct | null>(null);
  const [kind, setKind] = useState<MovementKind>("sale");
  const [amount, setAmount] = useState("1");
  const [message, setMessage] = useState<string | null>(null);

  const needle = query.trim().toLocaleLowerCase("bg");
  const products = (catalog?.products ?? [])
    .filter((p) => !needle || p.name.toLocaleLowerCase("bg").includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, "bg"));

  function choose(product: CachedProduct) {
    setSelected(product);
    setKind("sale");
    setAmount("1");
    setMessage(null);
  }

  function chooseKind(next: MovementKind) {
    setKind(next);
    const current = selected ? estimateQuantity(selected, queue) : 0;
    setAmount(next === "adjustment" ? String(Math.max(current, 0)).replace(".", ",") : "1");
  }

  function step(delta: number) {
    const value = parseQty(amount) ?? 0;
    setAmount(String(Math.max(0, Math.round((value + delta) * 1000) / 1000)).replace(".", ","));
  }

  function save() {
    if (!selected) return;
    const value = parseQty(amount);
    if (value === null || (kind !== "adjustment" && value === 0)) {
      setMessage("Въведете количество.");
      return;
    }
    const ok = enqueue([
      {
        client_id: newId(),
        product_id: selected.id,
        name: selected.name,
        unit: selected.unit,
        kind,
        amount: value,
        at: new Date().toISOString(),
        source: "manual",
        note: null,
      },
    ]);
    setMessage(ok ? `✓ ${selected.name}: записано на телефона` : "Телефонът не можа да запази записа.");
    if (ok) setSelected(null);
  }

  return (
    <>
      <header className="flex flex-col gap-3 pt-2">
        <h1 className="text-3xl font-bold">{online ? "Интернетът се върна" : "Няма интернет"}</h1>
        {online ? (
          <button
            type="button"
            // Пълно зареждане, а не навигация — страницата може да е от запазеното копие.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            onClick={() => window.location.assign("/")}
            className="btn btn-primary"
          >
            Към приложението
          </button>
        ) : (
          <p className="text-xl">
            Можете да записвате ръчно. Всичко се пази на телефона и се изпраща само, когато има
            интернет. Гласът не работи без интернет.
          </p>
        )}
      </header>

      {message && (
        <p role="status" className={message.startsWith("✓") ? "alert-success" : "alert-error"}>
          {message}
        </p>
      )}

      {selected ? (
        <section className="card flex flex-col gap-4">
          <h2 className="text-3xl font-bold break-words">{selected.name}</h2>
          <p className="text-xl text-muted">
            приблизително {formatQty(estimateQuantity(selected, queue))} {selected.unit}
          </p>
          <div className="grid grid-cols-1 gap-3" role="radiogroup" aria-label="Какво се случи">
            {OPTIONS.map((option) => (
              <button
                key={option.kind}
                type="button"
                role="radio"
                aria-checked={kind === option.kind}
                onClick={() => chooseKind(option.kind)}
                className={`btn ${kind === option.kind ? "btn-primary" : "btn-secondary"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label htmlFor="offline-amount" className="label">
            {OPTIONS.find((o) => o.kind === kind)!.hint}{" "}
            <span className="font-normal text-muted">({selected.unit})</span>
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
              id="offline-amount"
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
          <button type="button" onClick={save} className="btn btn-primary">
            Запиши на телефона
          </button>
          <button type="button" onClick={() => setSelected(null)} className="btn btn-secondary">
            Назад
          </button>
        </section>
      ) : catalog ? (
        <section className="flex flex-col gap-3">
          <p className="text-lg text-muted">
            Списък от {formatDateTime(catalog.savedAt)}. Натиснете продукт.
          </p>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Търси продукт…"
            aria-label="Търси продукт"
            className="field"
          />
          <ul className="flex flex-col gap-3">
            {products.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => choose(product)}
                  className="flex min-h-20 w-full items-center justify-between gap-4 rounded-2xl border-2 border-border bg-card p-4 text-left"
                >
                  <span className="text-2xl font-bold break-words">{product.name}</span>
                  <span className="shrink-0 text-2xl font-bold">
                    {formatQty(estimateQuantity(product, queue))}
                    <span className="ml-1 text-lg font-semibold">{product.unit}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="card text-xl">
          На този телефон още няма запазен списък с продукти. Отворете приложението веднъж, когато
          има интернет — после ще работи и без него.
        </p>
      )}

      {queue.length > 0 && (
        <section className="card flex flex-col gap-2">
          <h2 className="text-2xl font-bold">Чакат да се изпратят</h2>
          <ul className="flex flex-col gap-1 text-xl">
            {queue.map((item) => (
              <li key={item.client_id}>
                {item.name}: {KIND_LABELS[item.kind].toLowerCase()} {formatQty(item.amount)} {item.unit}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
