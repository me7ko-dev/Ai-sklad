import type { Metadata } from "next";
import Link from "next/link";
import { ErrorBox } from "@/components/error-box";
import { OrderBuilder } from "@/components/order-builder";
import { isLow, listProducts, listSuppliers, type Product, type Supplier } from "@/lib/products";

export const metadata: Metadata = { title: "Поръчка" };

export default async function OrderPage() {
  let products: Product[] = [];
  let suppliers: Supplier[] = [];
  let loadError: unknown = null;
  try {
    [products, suppliers] = await Promise.all([listProducts(), listSuppliers()]);
  } catch (error) {
    loadError = error;
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 p-4 pb-32">
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h1 className="text-3xl font-bold">Поръчка</h1>
        <Link href="/dostavchici" className="btn btn-secondary min-h-14 w-auto px-4 text-xl">
          Доставчици
        </Link>
      </div>
      {loadError ? (
        <ErrorBox error={loadError} />
      ) : (
        <OrderBuilder
          shopName={process.env.SHOP_NAME?.trim() || null}
          contacts={Object.fromEntries(
            suppliers.map((s) => [s.name.toLocaleLowerCase("bg"), { phone: s.phone, email: s.email }]),
          )}
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
