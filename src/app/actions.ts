"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KIND_LABELS, formatQty, parseMoney, parseQty, UNITS, type MovementKind } from "@/lib/format";
import {
  archiveProduct,
  createProduct,
  isLow,
  recordMovement,
  recordMovements,
  saveSupplier,
  undoMovement,
  updateProduct,
  type MovementRequest,
  type ProductInput,
} from "@/lib/products";
import { requireAuth } from "@/lib/session";
import { UUID } from "@/lib/sync";

export type FormState = { error?: string; success?: string };

const KINDS: MovementKind[] = ["sale", "delivery", "adjustment"];

function readProductInput(formData: FormData): ProductInput | string {
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const unit = String(formData.get("unit") ?? "").trim();
  const minQuantity = parseQty(formData.get("min_quantity") || "0");
  const packSize = parseQty(formData.get("pack_size") || "0");
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = priceRaw ? parseMoney(priceRaw) : null;
  const supplier = String(formData.get("supplier") ?? "").trim();
  const aliases = String(formData.get("aliases") ?? "")
    .split(",")
    .map((alias) => alias.trim().toLocaleLowerCase("bg"))
    .filter((alias, index, all) => alias && all.indexOf(alias) === index)
    .slice(0, 20);

  if (!name) return "Напишете име на продукта.";
  if (name.length > 80) return "Името е твърде дълго.";
  if (!(UNITS as readonly string[]).includes(unit)) return "Изберете мерна единица.";
  if (minQuantity === null) return "Минималното количество не е число.";
  if (packSize === null) return "Броят в кашон не е число.";
  if (priceRaw && price === null) return "Цената не е число. Пример: 2,40";

  return {
    name,
    unit,
    min_quantity: minQuantity,
    supplier: supplier ? supplier.slice(0, 80) : null,
    pack_size: packSize > 0 ? packSize : null,
    price,
    aliases: aliases.map((alias) => alias.slice(0, 40)),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Нещо се обърка. Опитайте пак.";
}

function refreshAll() {
  revalidatePath("/", "layout");
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
  refreshAll();
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
  refreshAll();
  return { success: "Промените са запазени." };
}

export async function archiveProductAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  await archiveProduct(id);
  refreshAll();
  redirect("/");
}

export async function recordMovementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "") as MovementKind;
  const amount = parseQty(formData.get("amount"));
  const clientId = String(formData.get("client_id") ?? "");

  if (!KINDS.includes(kind)) return { error: "Изберете какво се случи." };
  if (amount === null) return { error: "Въведете количество." };
  if (kind !== "adjustment" && amount === 0) return { error: "Количеството трябва да е повече от нула." };

  try {
    const product = await recordMovement(id, kind, amount, "manual", UUID.test(clientId) ? clientId : undefined);
    refreshAll();
    return {
      success: `${KIND_LABELS[kind]} записана. Сега има ${formatQty(product.quantity)} ${product.unit}`,
    };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export type SavedLine = {
  name: string;
  unit: string;
  kind: MovementKind;
  amount: number;
  quantity: number;
  low: boolean;
};

export type SaveVoiceResult = { error: string } | { saved: SavedLine[] };

// Записва потвърдените от собственика промени, разбрани от гласа.
export async function saveVoiceAction(
  items: MovementRequest[],
  transcript: string,
): Promise<SaveVoiceResult> {
  await requireAuth();

  if (!Array.isArray(items) || items.length === 0) return { error: "Няма какво да се запише." };
  if (items.length > 50) return { error: "Твърде много редове наведнъж." };
  for (const item of items) {
    if (!UUID.test(String(item?.product_id))) return { error: "Изберете продукт за всеки ред." };
    if (item.client_id !== undefined && !UUID.test(String(item.client_id))) {
      return { error: "Невалиден запис." };
    }
    if (!KINDS.includes(item.kind)) return { error: "Невалиден вид промяна." };
    if (typeof item.amount !== "number" || !Number.isFinite(item.amount) || item.amount < 0) {
      return { error: "Невалидно количество." };
    }
    if (item.kind !== "adjustment" && item.amount === 0) {
      return { error: "Количеството трябва да е повече от нула." };
    }
  }

  try {
    const clean = items.map(({ product_id, kind, amount, client_id }) => ({
      product_id,
      kind,
      amount: Math.round(amount * 1000) / 1000,
      client_id,
    }));
    const products = await recordMovements(clean, "voice", String(transcript ?? "").slice(0, 500) || null);
    refreshAll();
    return {
      saved: products.map((product, index) => ({
        name: product.name,
        unit: product.unit,
        kind: clean[index].kind,
        amount: clean[index].amount,
        quantity: product.quantity,
        low: isLow(product),
      })),
    };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export type QuickProductResult =
  | { error: string }
  | { product: { id: string; name: string; unit: string; quantity: number } };

// Бързо добавяне на продукт, който гласът не е намерил в списъка.
export async function createQuickProductAction(name: string, unit: string): Promise<QuickProductResult> {
  await requireAuth();
  const cleanName = String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!cleanName) return { error: "Липсва име на продукта." };
  const cleanUnit = (UNITS as readonly string[]).includes(unit) ? unit : "бр.";

  try {
    const product = await createProduct(
      {
        name: cleanName,
        unit: cleanUnit,
        min_quantity: 0,
        supplier: null,
        pack_size: null,
        price: null,
        aliases: [],
      },
      0,
    );
    refreshAll();
    return {
      product: { id: product.id, name: product.name, unit: product.unit, quantity: product.quantity },
    };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function undoMovementAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  await undoMovement(id);
  refreshAll();
}

export async function saveSupplierAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const previousName = String(formData.get("previous_name") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 40);
  const email = String(formData.get("email") ?? "").trim().slice(0, 120);
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);

  if (!name) return { error: "Напишете име на доставчика." };
  if (phone && !/^\+?[\d\s\-()]{6,}$/.test(phone)) {
    return { error: "Телефонът трябва да съдържа само цифри, напр. 0888 123 456." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Имейлът не изглежда правилно." };

  try {
    await saveSupplier(previousName, { name, phone: phone || null, email: email || null, note: note || null });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  refreshAll();
  // Ново или сменено име променя списъка — показваме потвърждението най-горе.
  if (previousName !== name) redirect(`/dostavchici?zapazeno=${encodeURIComponent(name)}`);
  return { success: "Запазено." };
}
