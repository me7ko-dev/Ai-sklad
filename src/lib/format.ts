export type MovementKind = "sale" | "delivery" | "adjustment";

export const UNITS = ["бр.", "кг", "л", "бут.", "пак.", "каш.", "кут."] as const;

export const KIND_LABELS: Record<MovementKind, string> = {
  sale: "Продажба",
  delivery: "Доставка",
  adjustment: "Корекция",
};

const qtyFormat = new Intl.NumberFormat("bg-BG", { maximumFractionDigits: 3 });

export function formatQty(value: number): string {
  return qtyFormat.format(value);
}

// Приема „1,5“ и „1.5“. Връща null при празно или невалидно число.
export function parseQty(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return null;
  return Math.round(value * 1000) / 1000;
}

const dateTimeFormat = new Intl.DateTimeFormat("bg-BG", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Sofia",
});

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}
