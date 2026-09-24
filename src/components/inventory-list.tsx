"use client";

import Link from "next/link";
import { useState } from "react";
import { formatQty } from "@/lib/format";

type Item = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  low: boolean;
};

export function InventoryList({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase("bg");
  const visible = needle
    ? items.filter((item) => item.name.toLocaleLowerCase("bg").includes(needle))
    : items;

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Търси продукт…"
        aria-label="Търси продукт"
        className="field"
      />

      {visible.length === 0 && (
        <p className="card text-center text-xl">Няма продукт с такова име.</p>
      )}

      <ul className="flex flex-col gap-3">
        {visible.map((item) => (
          <li key={item.id}>
            <Link
              href={`/produkt/${item.id}`}
              className={`flex min-h-20 items-center justify-between gap-4 rounded-2xl border-2 p-4 active:scale-[0.99] ${
                item.low ? "border-danger bg-danger-bg" : "border-border bg-card"
              }`}
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-2xl font-bold break-words">{item.name}</span>
                {item.low && (
                  <span className="text-xl font-bold text-danger">
                    {item.quantity <= 0 ? "⚠ Свърши!" : "⚠ Свършва"}
                  </span>
                )}
              </span>
              <span
                className={`shrink-0 text-right text-3xl font-bold ${item.low ? "text-danger" : ""}`}
              >
                {formatQty(item.quantity)}
                <span className="ml-1 text-xl font-semibold">{item.unit}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
