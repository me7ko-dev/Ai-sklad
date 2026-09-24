"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";
import { UNITS } from "@/lib/format";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  suppliers: string[];
  product?: {
    id: string;
    name: string;
    unit: string;
    min_quantity: number;
    supplier: string | null;
  };
};

export function ProductForm({ action, submitLabel, suppliers, product }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {product && <input type="hidden" name="id" value={product.id} />}

      <label className="flex flex-col gap-2">
        <span className="label">Име на продукта</span>
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={product?.name}
          placeholder="напр. Олио 1 л"
          className="field"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="label">Мерна единица</span>
        <select name="unit" defaultValue={product?.unit ?? "бр."} className="field">
          {UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </label>

      {!product && (
        <label className="flex flex-col gap-2">
          <span className="label">Колко има сега</span>
          <input name="quantity" inputMode="decimal" defaultValue="0" className="field" />
        </label>
      )}

      <label className="flex flex-col gap-2">
        <span className="label">Предупреди ме, когато останат</span>
        <input
          name="min_quantity"
          inputMode="decimal"
          defaultValue={product?.min_quantity ?? 5}
          className="field"
        />
        <span className="text-lg text-muted">
          При това количество или по-малко продуктът става червен.
        </span>
      </label>

      <label className="flex flex-col gap-2">
        <span className="label">Доставчик (по желание)</span>
        <input
          name="supplier"
          maxLength={80}
          list="suppliers"
          defaultValue={product?.supplier ?? ""}
          placeholder="напр. Метро"
          className="field"
        />
        <datalist id="suppliers">
          {suppliers.map((supplier) => (
            <option key={supplier} value={supplier} />
          ))}
        </datalist>
      </label>

      {state.error && (
        <p role="alert" className="alert-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="alert-success">
          {state.success}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Записвам…" : submitLabel}
      </button>
    </form>
  );
}
