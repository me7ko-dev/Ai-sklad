"use client";

import { archiveProductAction } from "@/app/actions";

export function ArchiveButton({ productId, name }: { productId: string; name: string }) {
  return (
    <form
      action={archiveProductAction}
      onSubmit={(event) => {
        if (!confirm(`Да изтрия ли „${name}“ от списъка?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={productId} />
      <button type="submit" className="btn btn-danger">
        Изтрий продукта
      </button>
    </form>
  );
}
