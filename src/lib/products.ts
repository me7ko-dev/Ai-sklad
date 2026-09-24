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
};

export type Movement = {
  id: number;
  kind: MovementKind;
  quantity_change: number;
  quantity_after: number;
  source: "manual" | "voice";
  created_at: string;
};

export type ProductInput = {
  name: string;
  unit: string;
  min_quantity: number;
  supplier: string | null;
};

const PRODUCT_COLUMNS = "id, name, unit, quantity, min_quantity, supplier";

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
  };
}

// Превежда грешките от базата на разбираем български.
function explain(error: { code?: string; message: string }): Error {
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "PGRST202") {
    return new Error(
      "Базата данни още не е подготвена. Пуснете файла supabase/schema.sql в Supabase → SQL Editor.",
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
    .select("id, kind, quantity_change, quantity_after, source, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw explain(error);
  return data.map((row) => ({
    ...row,
    quantity_change: Number(row.quantity_change),
    quantity_after: Number(row.quantity_after),
  })) as Movement[];
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
