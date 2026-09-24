import type { Metadata } from "next";
import Link from "next/link";
import { ErrorBox } from "@/components/error-box";
import { UndoButton } from "@/components/undo-button";
import { startOfDay, startOfWeek } from "@/lib/dates";
import { KIND_LABELS, formatDateTime, formatMoney, formatQty, formatTime } from "@/lib/format";
import {
  listMovementsSince,
  movementSummary,
  type MovementWithProduct,
  type SummaryRow,
} from "@/lib/products";

export const metadata: Metadata = { title: "История" };

const PERIODS = {
  den: { label: "Днес", from: startOfDay },
  sedmica: { label: "Тази седмица", from: startOfWeek },
} as const;

type Period = keyof typeof PERIODS;

export default async function HistoryPage({ searchParams }: PageProps<"/istoriya">) {
  const { period: raw } = await searchParams;
  const period: Period = raw === "sedmica" ? "sedmica" : "den";
  const from = PERIODS[period].from();

  let summary: SummaryRow[] = [];
  let movements: MovementWithProduct[] = [];
  let loadError: unknown = null;
  try {
    [summary, movements] = await Promise.all([movementSummary(from), listMovementsSince(from)]);
  } catch (error) {
    loadError = error;
  }

  const sold = summary.filter((row) => row.sold > 0).sort((a, b) => b.sold - a.sold);
  const revenue = summary.reduce((total, row) => total + row.revenue, 0);
  const unpriced = summary.filter((row) => row.unpriced_sales > 0).map((row) => row.name);
  const delivered = summary.filter((row) => row.delivered > 0).sort((a, b) => b.delivered - a.delivered);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 p-4 pb-32">
      <h1 className="pt-2 text-3xl font-bold">История</h1>

      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(PERIODS) as Period[]).map((key) => (
          <Link
            key={key}
            href={`/istoriya?period=${key}`}
            aria-current={period === key ? "page" : undefined}
            className={`btn text-xl ${period === key ? "btn-primary" : "btn-secondary"}`}
          >
            {PERIODS[key].label}
          </Link>
        ))}
      </div>

      {loadError ? <ErrorBox error={loadError} /> : null}

      <section className="card flex flex-col gap-1 text-center">
        <h2 className="text-xl font-semibold text-muted">Оборот</h2>
        <p className="text-5xl font-bold">{formatMoney(revenue)}</p>
        {unpriced.length > 0 && (
          <p className="mt-2 text-lg text-muted">
            Без цена (не са в оборота): {unpriced.join(", ")}. Задайте цена от екрана на продукта.
          </p>
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Продадено</h2>
        {sold.length === 0 ? (
          <p className="text-xl text-muted">Няма продажби.</p>
        ) : (
          <ul className="flex flex-col divide-y-2 divide-border">
            {sold.map((row) => (
              <li key={row.product_id} className="flex items-center justify-between gap-3 py-2 text-xl">
                <span className="font-semibold">{row.name}</span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="font-bold">
                    {formatQty(row.sold)} {row.unit}
                  </span>
                  {row.revenue > 0 && (
                    <span className="text-lg text-muted">{formatMoney(row.revenue)}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Доставено</h2>
        {delivered.length === 0 ? (
          <p className="text-xl text-muted">Няма доставки.</p>
        ) : (
          <ul className="flex flex-col divide-y-2 divide-border">
            {delivered.map((row) => (
              <li key={row.product_id} className="flex items-center justify-between gap-3 py-2 text-xl">
                <span className="font-semibold">{row.name}</span>
                <span className="shrink-0 font-bold text-primary">
                  +{formatQty(row.delivered)} {row.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Всички записи</h2>
        {movements.length === 0 ? (
          <p className="card text-xl text-muted">Няма записи за този период.</p>
        ) : (
          <ul className="card flex flex-col divide-y-2 divide-border py-1">
            {movements.map((movement, index) => {
              // Един гласов запис може да промени няколко продукта — текстът се показва веднъж.
              const showNote = movement.note && movement.note !== movements[index - 1]?.note;
              const sign = movement.quantity_change > 0 ? "+" : "";
              const change = `${sign}${formatQty(movement.quantity_change)} ${movement.unit}`;
              return (
                <li
                  key={movement.id}
                  className={`flex flex-col gap-1 py-3 ${movement.undone_at ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 flex-col">
                      <Link
                        href={`/produkt/${movement.product_id}`}
                        className="text-xl font-bold break-words"
                      >
                        {movement.product_name}
                      </Link>
                      <span className="text-lg text-muted">
                        {KIND_LABELS[movement.kind]}
                        {movement.source === "voice" ? " 🎤" : ""} ·{" "}
                        {period === "den"
                          ? formatTime(movement.created_at)
                          : formatDateTime(movement.created_at)}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-2xl font-bold ${
                        movement.quantity_change < 0 ? "text-danger" : "text-primary"
                      } ${movement.undone_at ? "line-through" : ""}`}
                    >
                      {change}
                    </span>
                  </div>
                  {showNote && (
                    <p className="text-lg text-muted italic">„{movement.note}“</p>
                  )}
                  <div className="flex justify-end">
                    {movement.undone_at ? (
                      <span className="text-lg text-muted">отменено</span>
                    ) : (
                      <UndoButton
                        movementId={movement.id}
                        label={`${movement.product_name} ${change}`}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {movements.length >= 200 && (
          <p className="text-lg text-muted">Показани са последните 200 записа.</p>
        )}
      </section>
    </main>
  );
}
