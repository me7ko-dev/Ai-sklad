"use client";

import { useSyncExternalStore } from "react";
import type { MovementKind } from "./format";

// Записи, направени без интернет, и последният известен списък с продукти.
// Пазят се в телефона (localStorage) и се изпращат, щом има връзка.

export type QueueItem = {
  client_id: string;
  product_id: string;
  name: string;
  unit: string;
  kind: MovementKind;
  amount: number;
  at: string;
  source: "manual" | "voice";
  note: string | null;
};

export type CachedProduct = { id: string; name: string; unit: string; quantity: number };

type Catalog = { savedAt: string; products: CachedProduct[] };

const QUEUE_KEY = "sklad:queue";
const CATALOG_KEY = "sklad:catalog";
const EVENT = "sklad:offline-change";

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    return false;
  }
}

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Резервен вариант за стари браузъри.
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
  );
}

export function loadQueue(): QueueItem[] {
  return parse<QueueItem[]>(readRaw(QUEUE_KEY), []);
}

export function enqueue(items: QueueItem[]): boolean {
  return write(QUEUE_KEY, [...loadQueue(), ...items]);
}

export function removeFromQueue(ids: string[]): void {
  const remove = new Set(ids);
  write(
    QUEUE_KEY,
    loadQueue().filter((item) => !remove.has(item.client_id)),
  );
}

export function saveCatalog(products: CachedProduct[]): void {
  write(CATALOG_KEY, { savedAt: new Date().toISOString(), products } satisfies Catalog);
}

// Наличност според последния списък плюс записите, които още чакат.
export function estimateQuantity(product: CachedProduct, queue: QueueItem[]): number {
  let quantity = product.quantity;
  for (const item of queue) {
    if (item.product_id !== product.id) continue;
    if (item.kind === "sale") quantity -= item.amount;
    else if (item.kind === "delivery") quantity += item.amount;
    else quantity = item.amount;
  }
  return Math.round(quantity * 1000) / 1000;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useQueue(): QueueItem[] {
  const raw = useSyncExternalStore(subscribe, () => readRaw(QUEUE_KEY), () => null);
  return parse<QueueItem[]>(raw, []);
}

export function useCatalog(): Catalog | null {
  const raw = useSyncExternalStore(subscribe, () => readRaw(CATALOG_KEY), () => null);
  return parse<Catalog | null>(raw, null);
}

export type FlushResult = { sent: number; rejected: { name: string; reason: string }[] };

let flushing = false;

// Изпраща чакащите записи. Връща null, ако няма какво или няма връзка.
export async function flushQueue(): Promise<FlushResult | null> {
  if (flushing || !navigator.onLine) return null;
  const queue = loadQueue();
  if (queue.length === 0) return null;

  flushing = true;
  try {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: queue }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      sent: string[];
      rejected: { client_id: string; reason: string }[];
    };
    removeFromQueue([...data.sent, ...data.rejected.map((r) => r.client_id)]);
    return {
      sent: data.sent.length,
      rejected: data.rejected.map((r) => ({
        name: queue.find((item) => item.client_id === r.client_id)?.name ?? "?",
        reason: r.reason,
      })),
    };
  } catch {
    return null;
  } finally {
    flushing = false;
  }
}
