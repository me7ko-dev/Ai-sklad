"use client";

import { undoMovementAction } from "@/app/actions";

export function UndoButton({ movementId, label }: { movementId: number; label: string }) {
  return (
    <form
      action={undoMovementAction}
      onSubmit={(event) => {
        if (!confirm(`Да отменя ли „${label}“? Наличността ще се върне.`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={movementId} />
      <button type="submit" className="min-h-12 px-2 text-lg text-danger underline">
        Отмени
      </button>
    </form>
  );
}
