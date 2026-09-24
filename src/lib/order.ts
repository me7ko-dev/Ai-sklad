export type OrderProduct = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  supplier: string | null;
  pack_size: number | null;
};

export type OrderLine = {
  id: string;
  name: string;
  unit: string;
  amount: number;
};

export const NO_SUPPLIER = "Без доставчик";

// Колко да се поръча: да стигне до два пъти минимума, поне 1,
// закръглено нагоре до цели кашони, ако знаем колко има в кашон.
export function suggestedAmount(product: OrderProduct): number {
  const needed = Math.max(product.min_quantity * 2 - product.quantity, 1);
  if (product.pack_size && product.pack_size > 0) {
    return Math.ceil(needed / product.pack_size) * product.pack_size;
  }
  return Math.ceil(needed);
}

export function groupBySupplier<T extends { supplier: string | null; name: string }>(
  products: T[],
): { supplier: string; products: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const product of products) {
    const key = product.supplier?.trim() || NO_SUPPLIER;
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }
  return [...groups.entries()]
    .map(([supplier, items]) => ({
      supplier,
      products: items.sort((a, b) => a.name.localeCompare(b.name, "bg")),
    }))
    .sort((a, b) => {
      if (a.supplier === NO_SUPPLIER) return 1;
      if (b.supplier === NO_SUPPLIER) return -1;
      return a.supplier.localeCompare(b.supplier, "bg");
    });
}

export function orderMessage(
  lines: OrderLine[],
  supplier: string,
  shopName: string | null,
  format: (value: number) => string,
): string {
  const from = shopName ? ` от ${shopName}` : "";
  const greeting = supplier === NO_SUPPLIER ? "Здравейте!" : `Здравейте, ${supplier}!`;
  const rows = lines.map((line, index) => `${index + 1}. ${line.name} — ${format(line.amount)} ${line.unit}`);
  return [greeting, `Поръчка${from}:`, "", ...rows, "", "Благодаря!"].join("\n");
}
