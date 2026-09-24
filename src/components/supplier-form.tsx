"use client";

import { useActionState } from "react";
import { saveSupplierAction, type FormState } from "@/app/actions";

type Props = {
  supplier?: { name: string; phone: string | null; email: string | null; note: string | null };
  submitLabel: string;
};

export function SupplierForm({ supplier, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveSupplierAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {supplier && <input type="hidden" name="previous_name" value={supplier.name} />}
      <label className="flex flex-col gap-2">
        <span className="label">Име</span>
        <input name="name" required maxLength={80} defaultValue={supplier?.name} className="field" />
      </label>
      <label className="flex flex-col gap-2">
        <span className="label">Телефон (за Viber, SMS и обаждане)</span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          maxLength={40}
          defaultValue={supplier?.phone ?? ""}
          placeholder="напр. 0888 123 456"
          className="field"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="label">Имейл (по желание)</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          maxLength={120}
          defaultValue={supplier?.email ?? ""}
          className="field"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="label">Бележка (по желание)</span>
        <input
          name="note"
          maxLength={300}
          defaultValue={supplier?.note ?? ""}
          placeholder="напр. идва във вторник"
          className="field"
        />
      </label>
      {state.error && (
        <p role="alert" className="alert-error">
          {state.error}
        </p>
      )}
      {state.success && !pending && (
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
