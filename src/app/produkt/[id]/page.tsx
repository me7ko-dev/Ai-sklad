import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchiveButton } from "@/components/archive-button";
import { BackLink } from "@/components/back-link";
import { ErrorBox } from "@/components/error-box";
import { MovementForm } from "@/components/movement-form";
import { ProductForm } from "@/components/product-form";
import { KIND_LABELS, formatDateTime, formatMoney, formatQty } from "@/lib/format";
import { getProduct, isLow, listMovements, listProducts } from "@/lib/products";
import { updateProductAction } from "../../actions";

export const metadata: Metadata = { title: "Продукт" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProductPage({ params, searchParams }: PageProps<"/produkt/[id]">) {
  const { id } = await params;
  const { nov } = await searchParams;
  if (!UUID.test(id)) notFound();

  let data;
  try {
    const [product, movements, all] = await Promise.all([
      getProduct(id),
      listMovements(id),
      listProducts(),
    ]);
    data = { product, movements, all };
  } catch (error) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 p-4">
        <BackLink />
        <ErrorBox error={error} />
      </main>
    );
  }

  const { product, movements, all } = data;
  if (!product) notFound();

  const low = isLow(product);
  const suppliers = [...new Set(all.map((p) => p.supplier).filter((s): s is string => !!s))].sort();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 pb-32">
      <BackLink />

      {nov === "1" && (
        <p role="status" className="alert-success">
          Продуктът е добавен.
        </p>
      )}

      <section
        className={`rounded-2xl border-2 p-5 text-center ${
          low ? "border-danger bg-danger-bg" : "border-border bg-card"
        }`}
      >
        <h1 className="text-3xl font-bold break-words">{product.name}</h1>
        <p className={`mt-3 text-6xl font-bold ${low ? "text-danger" : ""}`}>
          {formatQty(product.quantity)}
          <span className="ml-2 text-3xl">{product.unit}</span>
        </p>
        {low && (
          <p className="mt-2 text-2xl font-bold text-danger">
            {product.quantity <= 0 ? "⚠ Свърши!" : "⚠ Свършва — време е за поръчка"}
          </p>
        )}
        {product.price != null && (
          <p className="mt-2 text-2xl font-semibold">
            {formatMoney(product.price)} / {product.unit}
          </p>
        )}
        <p className="mt-2 text-lg text-muted">
          Предупреждение при {formatQty(product.min_quantity)} {product.unit}
          {product.supplier ? ` · Доставчик: ${product.supplier}` : ""}
        </p>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Какво се случи?</h2>
        <MovementForm
          productId={product.id}
          name={product.name}
          unit={product.unit}
          quantity={product.quantity}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Последни промени</h2>
        {movements.length === 0 ? (
          <p className="card text-xl">Още няма записани промени.</p>
        ) : (
          <ul className="card flex flex-col divide-y-2 divide-border py-1">
            {movements.map((movement) => (
              <li
                key={movement.id}
                className={`flex items-center justify-between gap-3 py-3 ${
                  movement.undone_at ? "opacity-50" : ""
                }`}
              >
                <span className="flex flex-col">
                  <span className="text-xl font-semibold">
                    {KIND_LABELS[movement.kind]}
                    {movement.source === "voice" ? " 🎤" : ""}
                    {movement.undone_at ? " (отменено)" : ""}
                  </span>
                  <span className="text-lg text-muted">{formatDateTime(movement.created_at)}</span>
                </span>
                <span
                  className={`shrink-0 text-2xl font-bold ${
                    movement.quantity_change < 0 ? "text-danger" : "text-primary"
                  } ${movement.undone_at ? "line-through" : ""}`}
                >
                  {movement.quantity_change > 0 ? "+" : ""}
                  {formatQty(movement.quantity_change)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="card">
        <summary className="min-h-12 cursor-pointer text-2xl font-bold">Промени продукта</summary>
        <div className="mt-4 flex flex-col gap-6">
          <ProductForm
            action={updateProductAction}
            submitLabel="Запази промените"
            suppliers={suppliers}
            product={product}
          />
          <ArchiveButton productId={product.id} name={product.name} />
        </div>
      </details>
    </main>
  );
}
