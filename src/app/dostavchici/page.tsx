import type { Metadata } from "next";
import Link from "next/link";
import { ErrorBox } from "@/components/error-box";
import { SupplierForm } from "@/components/supplier-form";
import { listSuppliers, type Supplier } from "@/lib/products";

export const metadata: Metadata = { title: "Доставчици" };

export default async function SuppliersPage({ searchParams }: PageProps<"/dostavchici">) {
  const { zapazeno } = await searchParams;
  let suppliers: Supplier[] = [];
  let loadError: unknown = null;
  try {
    suppliers = await listSuppliers();
  } catch (error) {
    loadError = error;
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 p-4 pb-32">
      <Link href="/poruchka" className="inline-flex min-h-14 items-center text-2xl font-semibold text-primary">
        ← Към поръчката
      </Link>
      <h1 className="text-3xl font-bold">Доставчици</h1>
      <p className="text-xl">
        С телефон и имейл поръчката се праща направо на доставчика. Кой продукт от кой доставчик
        е, се избира от екрана на продукта.
      </p>

      {typeof zapazeno === "string" && (
        <p role="status" className="alert-success">
          Запазено: {zapazeno}
        </p>
      )}

      {loadError ? <ErrorBox error={loadError} /> : null}

      {suppliers.map((supplier) => (
        <details key={supplier.name} className="card">
          <summary className="flex min-h-12 cursor-pointer flex-col justify-center">
            <span className="text-2xl font-bold">{supplier.name}</span>
            <span className="text-lg text-muted">
              {[supplier.phone, supplier.email].filter(Boolean).join(" · ") || "няма телефон и имейл"}
            </span>
          </summary>
          <div className="mt-4">
            <SupplierForm supplier={supplier} submitLabel="Запази" />
          </div>
        </details>
      ))}

      <details className="card" open={suppliers.length === 0}>
        <summary className="min-h-12 cursor-pointer text-2xl font-bold text-primary">
          + Нов доставчик
        </summary>
        <div className="mt-4">
          <SupplierForm submitLabel="Добави" />
        </div>
      </details>
    </main>
  );
}
