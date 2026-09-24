"use client";

import { useState } from "react";
import { formatQty } from "@/lib/format";
import {
  groupBySupplier,
  orderMessage,
  suggestedAmount,
  type OrderLine,
  type OrderProduct,
} from "@/lib/order";

type Item = OrderProduct & { low: boolean };
type Line = { included: boolean; amount: string };

function parseAmount(value: string): number | null {
  const number = Number(value.trim().replace(",", "."));
  return value.trim() && Number.isFinite(number) && number > 0 ? number : null;
}

function showAmount(value: number): string {
  return String(Math.round(value * 1000) / 1000).replace(".", ",");
}

export function OrderBuilder({ products, shopName }: { products: Item[]; shopName: string | null }) {
  const [lines, setLines] = useState<Record<string, Line>>(() =>
    Object.fromEntries(
      products
        .filter((p) => p.low)
        .map((p) => [p.id, { included: true, amount: showAmount(suggestedAmount(p)) }]),
    ),
  );
  const [copied, setCopied] = useState<string | null>(null);

  const inOrder = products.filter((p) => lines[p.id]);
  const notInOrder = products
    .filter((p) => !lines[p.id])
    .sort((a, b) => a.name.localeCompare(b.name, "bg"));
  const groups = groupBySupplier(inOrder);

  function update(id: string, change: Partial<Line>) {
    setLines((current) => ({ ...current, [id]: { ...current[id], ...change } }));
  }

  function add(id: string) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setLines((current) => ({
      ...current,
      [id]: { included: true, amount: showAmount(suggestedAmount(product)) },
    }));
  }

  async function copy(supplier: string, message: string) {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(supplier);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      alert("Не успях да копирам. Задръжте пръст върху текста, за да го копирате.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {inOrder.length === 0 && (
        <p className="alert-success">Нищо не свършва. Можете да добавите продукт отдолу.</p>
      )}

      {groups.map(({ supplier, products: groupProducts }) => {
        const orderLines: OrderLine[] = groupProducts.flatMap((p) => {
          const line = lines[p.id];
          const amount = parseAmount(line.amount);
          return line.included && amount ? [{ id: p.id, name: p.name, unit: p.unit, amount }] : [];
        });
        const message = orderMessage(orderLines, supplier, shopName, formatQty);
        const encoded = encodeURIComponent(message);
        const empty = orderLines.length === 0;

        return (
          <section key={supplier} className="card flex flex-col gap-4">
            <h2 className="text-2xl font-bold">{supplier}</h2>

            <ul className="flex flex-col gap-3">
              {groupProducts.map((p) => {
                const line = lines[p.id];
                return (
                  <li key={p.id} className="flex flex-col gap-2 border-b-2 border-border pb-3 last:border-0">
                    <label className="flex min-h-12 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={line.included}
                        onChange={(event) => update(p.id, { included: event.target.checked })}
                        className="h-8 w-8 shrink-0 accent-primary"
                      />
                      <span className="flex flex-col">
                        <span className="text-xl font-bold">{p.name}</span>
                        <span className={`text-lg ${p.low ? "text-danger" : "text-muted"}`}>
                          има {formatQty(p.quantity)} {p.unit}
                          {p.pack_size ? ` · в кашон ${formatQty(p.pack_size)}` : ""}
                        </span>
                      </span>
                    </label>
                    {line.included && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`По-малко ${p.name}`}
                          onClick={() =>
                            update(p.id, {
                              amount: showAmount(
                                Math.max(1, (parseAmount(line.amount) ?? 0) - (p.pack_size || 1)),
                              ),
                            })
                          }
                          className="btn btn-secondary min-h-14 w-14 shrink-0 px-0 text-3xl"
                        >
                          −
                        </button>
                        <input
                          aria-label={`Количество ${p.name}`}
                          inputMode="decimal"
                          value={line.amount}
                          onChange={(event) => update(p.id, { amount: event.target.value })}
                          className="field min-h-14 min-w-0 flex-1 px-1 text-center text-2xl font-bold"
                        />
                        <button
                          type="button"
                          aria-label={`Повече ${p.name}`}
                          onClick={() =>
                            update(p.id, {
                              amount: showAmount((parseAmount(line.amount) ?? 0) + (p.pack_size || 1)),
                            })
                          }
                          className="btn btn-secondary min-h-14 w-14 shrink-0 px-0 text-3xl"
                        >
                          +
                        </button>
                        <span className="w-12 shrink-0 text-lg">{p.unit}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {!empty && (
              <pre className="rounded-xl bg-background p-3 font-sans text-lg whitespace-pre-wrap">
                {message}
              </pre>
            )}

            <div className="grid grid-cols-1 gap-3">
              <a
                href={empty ? undefined : `viber://forward?text=${encoded}`}
                aria-disabled={empty}
                className={`btn bg-[#7360f2] text-xl text-white ${empty ? "pointer-events-none opacity-50" : ""}`}
              >
                Изпрати по Viber
              </a>
              <a
                href={
                  empty
                    ? undefined
                    : `mailto:?subject=${encodeURIComponent(`Поръчка${shopName ? ` — ${shopName}` : ""}`)}&body=${encoded}`
                }
                aria-disabled={empty}
                className={`btn btn-secondary text-xl ${empty ? "pointer-events-none opacity-50" : ""}`}
              >
                Изпрати по имейл
              </a>
              <button
                type="button"
                disabled={empty}
                onClick={() => copy(supplier, message)}
                className="btn btn-secondary text-xl"
              >
                {copied === supplier ? "✓ Копирано" : "Копирай текста"}
              </button>
            </div>
          </section>
        );
      })}

      {notInOrder.length > 0 && (
        <label className="flex flex-col gap-2">
          <span className="label">Добави друг продукт към поръчката</span>
          <select
            value=""
            onChange={(event) => event.target.value && add(event.target.value)}
            className="field text-xl"
          >
            <option value="">— изберете —</option>
            {notInOrder.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (има {formatQty(p.quantity)} {p.unit})
              </option>
            ))}
          </select>
        </label>
      )}

      <p className="text-lg text-muted">
        Предложеното количество стига до два пъти прага за предупреждение. Ако знаете колко има в
        кашон, се закръгля до цели кашони. Доставчикът се задава от екрана на продукта.
      </p>
    </div>
  );
}
