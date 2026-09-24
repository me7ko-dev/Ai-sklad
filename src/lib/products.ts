import "server-only";
import { db } from "./supabase";
import type { MovementKind } from "./format";

export type Product = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  supplier: string | null;
  pack_size: number | null;
  aliases: string[];
};

export type Movement = {
  id: number;
  kind: MovementKind;
  quantity_change: number;
  quantity_after: number;
  source: "manual" | "voice";
  note: string | null;
  created_at: string;
  undone_at: string | null;
};

export type MovementWithProduct = Movement & {
  product_id: string;
  product_name: string;
  unit: string;
};

export type SummaryRow = {
  product_id: string;
  name: string;
  unit: string;
  sold: number;
  delivered: number;
  adjusted: number;
  movements: number;
};

export type ProductInput = {
  name: string;
  unit: string;
  min_quantity: number;
  supplier: string | null;
  pack_size: number | null;
  aliases: string[];
};

export type MovementRequest = {
  product_id: string;
  kind: MovementKind;
  amount: number;
};

const PRODUCT_COLUMNS = "id, name, unit, quantity, min_quantity, supplier, pack_size, aliases";
const MOVEMENT_COLUMNS =
  "id, product_id, kind, quantity_change, quantity_after, source, note, created_at, undone_at";

export function isLow(product: Product): boolean {
  return product.quantity <= product.min_quantity;
}

function toProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    name: String(row.name),
    unit: String(row.unit),
    quantity: Number(row.quantity),
    min_quantity: Number(row.min_quantity),
    supplier: (row.supplier as string | null) ?? null,
    pack_size: row.pack_size == null ? null : Number(row.pack_size),
    aliases: Array.isArray(row.aliases) ? (row.aliases as string[]) : [],
  };
}

function toMovement(row: Record<string, unknown>): Movement {
  return {
    id: Number(row.id),
    kind: row.kind as MovementKind,
    quantity_change: Number(row.quantity_change),
    quantity_after: Number(row.quantity_after),
    source: row.source as Movement["source"],
    note: (row.note as string | null) ?? null,
    created_at: String(row.created_at),
    undone_at: (row.undone_at as string | null) ?? null,
  };
}

// Превежда грешките от базата на разбираем български.
function explain(error: { code?: string; message: string }): Error {
  if (["PGRST205", "PGRST204", "PGRST202", "42P01", "42703"].includes(error.code ?? "")) {
    return new Error(
      "Базата данни не е подготвена или е от стара версия. Пуснете (отново) файла supabase/schema.sql в Supabase → SQL Editor.",
    );
  }
  if (error.code === "42501") {
    return new Error(
      "Приложението няма достъп до базата. Проверете SUPABASE_SECRET_KEY и пуснете отново supabase/schema.sql.",
    );
  }
  if (error.code === "23505") {
    return new Error("Вече има продукт с това име.");
  }
  if (error.code === "P0001") {
    return new Error(error.message);
  }
  console.error("Supabase:", error);
  return new Error("Възникна грешка при връзката с базата. Опитайте пак.");
}

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await db()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("archived", false)
    .order("name");
  if (error) throw explain(error);
  return data.map(toProduct);
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await db()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("id", id)
    .eq("archived", false)
    .maybeSingle();
  if (error) throw explain(error);
  return data ? toProduct(data) : null;
}

export async function listMovements(productId: string, limit = 10): Promise<Movement[]> {
  const { data, error } = await db()
    .from("stock_movements")
    .select(MOVEMENT_COLUMNS)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw explain(error);
  return data.map(toMovement);
}

// Последните записи от даден момент насам, с името на продукта.
export async function listMovementsSince(from: Date, limit = 200): Promise<MovementWithProduct[]> {
  const { data, error } = await db()
    .from("stock_movements")
    .select(`${MOVEMENT_COLUMNS}, products(name, unit)`)
    .gte("created_at", from.toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw explain(error);
  return data.map((row) => {
    const product = row.products as unknown as { name: string; unit: string } | null;
    return {
      ...toMovement(row),
      product_id: String(row.product_id),
      product_name: product?.name ?? "?",
      unit: product?.unit ?? "",
    };
  });
}

export async function movementSummary(from: Date): Promise<SummaryRow[]> {
  const { data, error } = await db().rpc("movement_summary", { p_from: from.toISOString() });
  if (error) throw explain(error);
  return (data as Record<string, unknown>[]).map((row) => ({
    product_id: String(row.product_id),
    name: String(row.name),
    unit: String(row.unit),
    sold: Number(row.sold),
    delivered: Number(row.delivered),
    adjusted: Number(row.adjusted),
    movements: Number(row.movements),
  }));
}

export async function createProduct(input: ProductInput, quantity: number): Promise<Product> {
  const { data, error } = await db()
    .from("products")
    .insert({ ...input, quantity: 0 })
    .select(PRODUCT_COLUMNS)
    .single();
  if (error) throw explain(error);
  const product = toProduct(data);
  // Началната наличност се записва като доставка, за да остане в историята.
  if (quantity > 0) return recordMovement(product.id, "delivery", quantity);
  return product;
}

export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  const { error } = await db()
    .from("products")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("archived", false);
  if (error) throw explain(error);
}

export async function archiveProduct(id: string): Promise<void> {
  const { error } = await db()
    .from("products")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw explain(error);
}

export async function recordMovement(
  productId: string,
  kind: MovementKind,
  amount: number,
  source: "manual" | "voice" = "manual",
): Promise<Product> {
  const { data, error } = await db()
    .rpc("record_movement", {
      p_product_id: productId,
      p_kind: kind,
      p_amount: amount,
      p_source: source,
    })
    .single();
  if (error) throw explain(error);
  return toProduct(data as Record<string, unknown>);
}

// Записва няколко промени наведнъж — или всички, или нито една.
export async function recordMovements(
  items: MovementRequest[],
  source: "manual" | "voice",
  note: string | null,
): Promise<Product[]> {
  const { data, error } = await db().rpc("record_movements", {
    p_items: items,
    p_source: source,
    p_note: note,
  });
  if (error) throw explain(error);
  return (data as Record<string, unknown>[]).map(toProduct);
}

export async function undoMovement(movementId: number): Promise<Product> {
  const { data, error } = await db()
    .rpc("undo_movement", { p_movement_id: movementId })
    .single();
  if (error) throw explain(error);
  return toProduct(data as Record<string, unknown>);
}
