import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { ProductForm } from "@/components/product-form";
import { listProducts } from "@/lib/products";
import { createProductAction } from "../actions";

export const metadata: Metadata = { title: "Нов продукт" };

export default async function NewProductPage() {
  const suppliers = await listSuppliers();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 p-4 pb-32">
      <BackLink />
      <h1 className="text-3xl font-bold">Нов продукт</h1>
      <ProductForm action={createProductAction} submitLabel="Добави" suppliers={suppliers} />
    </main>
  );
}

async function listSuppliers(): Promise<string[]> {
  try {
    const products = await listProducts();
    return [...new Set(products.map((p) => p.supplier).filter((s): s is string => !!s))].sort();
  } catch {
    return [];
  }
}
