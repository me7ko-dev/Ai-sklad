import type { Metadata } from "next";
import { ErrorBox } from "@/components/error-box";
import { OrderBuilder } from "@/components/order-builder";
import { isLow, listProducts, type Product } from "@/lib/products";

export const metadata: Metadata = { title: "Поръчка" };

export default async function OrderPage() {
  let products: Product[] = [];
  let loadError: unknown = null;
  try {
    products = await listProducts();
  } catch (error) {
    loadError = error;
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 p-4 pb-32">
      <h1 className="pt-2 text-3xl font-bold">Поръчка към доставчик</h1>
      {loadError ? (
        <ErrorBox error={loadError} />
      ) : (
        <OrderBuilder
          shopName={process.env.SHOP_NAME?.trim() || null}
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unit,
            quantity: p.quantity,
            min_quantity: p.min_quantity,
            supplier: p.supplier,
            pack_size: p.pack_size,
            low: isLow(p),
          }))}
        />
      )}
    </main>
  );
}
