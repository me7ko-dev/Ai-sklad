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

// Само цифри с най-много една десетична точка (без „1e5“, „0x10“ и подобни).
const DECIMAL = /^(\d+\.?\d*|\.\d+)$/;

// Приема „1,5“ и „1.5“. Връща null при празно или невалидно число.
export function parseQty(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!DECIMAL.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return null;
  // Закръгляне през текст, за да няма грешки като 1,0005 → 1.
  return Math.round(Number(`${cleaned}e3`)) / 1000;
}

const dateTimeFormat = new Intl.DateTimeFormat("bg-BG", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Sofia",
});

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

const timeFormat = new Intl.DateTimeFormat("bg-BG", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Sofia",
});

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

const moneyFormat = new Intl.NumberFormat("bg-BG", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number): string {
  return moneyFormat.format(value);
}

// Цена в евро: „2,40“, „2.4“, „2,40 €“. Връща null при празно или невалидно.
export function parseMoney(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/[\s€]/g, "").replace("евро", "").replace(",", ".");
  if (!DECIMAL.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 100_000) return null;
  return Math.round(Number(`${cleaned}e2`)) / 100;
}
