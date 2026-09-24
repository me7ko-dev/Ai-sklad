"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KIND_LABELS, formatQty, parseQty, UNITS, type MovementKind } from "@/lib/format";
import {
  archiveProduct,
  createProduct,
  recordMovement,
  updateProduct,
  type ProductInput,
} from "@/lib/products";
import { requireAuth } from "@/lib/session";

export type FormState = { error?: string; success?: string };

const KINDS: MovementKind[] = ["sale", "delivery", "adjustment"];

function readProductInput(formData: FormData): ProductInput | string {
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const unit = String(formData.get("unit") ?? "").trim();
  const minQuantity = parseQty(formData.get("min_quantity") || "0");
  const supplier = String(formData.get("supplier") ?? "").trim();

  if (!name) return "Напишете име на продукта.";
  if (name.length > 80) return "Името е твърде дълго.";
  if (!(UNITS as readonly string[]).includes(unit)) return "Изберете мерна единица.";
  if (minQuantity === null) return "Минималното количество не е число.";

  return {
    name,
    unit,
    min_quantity: minQuantity,
    supplier: supplier ? supplier.slice(0, 80) : null,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Нещо се обърка. Опитайте пак.";
}

export async function createProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const input = readProductInput(formData);
  if (typeof input === "string") return { error: input };
  const quantity = parseQty(formData.get("quantity") || "0");
  if (quantity === null) return { error: "Наличността не е число." };

  let id: string;
  try {
    id = (await createProduct(input, quantity)).id;
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath("/");
  redirect(`/produkt/${id}?nov=1`);
}

export async function updateProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  const input = readProductInput(formData);
  if (typeof input === "string") return { error: input };

  try {
    await updateProduct(id, input);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath("/");
  revalidatePath(`/produkt/${id}`);
  return { success: "Промените са запазени." };
}

export async function archiveProductAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  await archiveProduct(id);
  revalidatePath("/");
  redirect("/");
}

export async function recordMovementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "") as MovementKind;
  const amount = parseQty(formData.get("amount"));

  if (!KINDS.includes(kind)) return { error: "Изберете какво се случи." };
  if (amount === null) return { error: "Въведете количество." };
  if (kind !== "adjustment" && amount === 0) return { error: "Количеството трябва да е повече от нула." };

  try {
    const product = await recordMovement(id, kind, amount);
    revalidatePath("/");
    revalidatePath(`/produkt/${id}`);
    return {
      success: `${KIND_LABELS[kind]} записана. Сега има ${formatQty(product.quantity)} ${product.unit}`,
    };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
