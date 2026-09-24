import Link from "next/link";
import { ErrorBox } from "@/components/error-box";
import { InventoryList } from "@/components/inventory-list";
import { isLow, listProducts, type Product } from "@/lib/products";
import { logout } from "./vhod/actions";

export default async function InventoryPage() {
  let products: Product[] = [];
  let loadError: unknown = null;
  try {
    products = await listProducts();
  } catch (error) {
    loadError = error;
  }

  // Първо това, което свършва, после по азбучен ред.
  const items = products
    .map((product) => ({
      id: product.id,
      name: product.name,
      unit: product.unit,
      quantity: product.quantity,
      low: isLow(product),
    }))
    .sort((a, b) => Number(b.low) - Number(a.low) || a.name.localeCompare(b.name, "bg"));
  const lowCount = items.filter((item) => item.low).length;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 p-4 pb-32">
      <header className="flex items-center justify-between gap-4 pt-2">
        <h1 className="text-3xl font-bold">Наличности</h1>
        <form action={logout}>
          <button type="submit" className="min-h-12 px-2 text-lg text-muted underline">
            Изход
          </button>
        </form>
      </header>

      {loadError ? <ErrorBox error={loadError} /> : null}

      {lowCount > 0 && (
        <p role="alert" className="alert-error text-2xl">
          ⚠ {lowCount === 1 ? "1 продукт свършва" : `${lowCount} продукта свършват`}
        </p>
      )}

      {!loadError && products.length === 0 ? (
        <div className="card flex flex-col gap-3 text-center text-xl">
          <p className="text-2xl font-bold">Още няма продукти</p>
          <p>Натиснете „Нов продукт“ отдолу, за да започнете.</p>
        </div>
      ) : (
        <InventoryList items={items} />
      )}

      <div className="fixed inset-x-0 bottom-0 border-t-2 border-border bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <Link href="/nov" className="btn btn-primary">
            + Нов продукт
          </Link>
        </div>
      </div>
    </main>
  );
}
