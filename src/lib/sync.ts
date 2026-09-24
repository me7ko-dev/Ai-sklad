import "server-only";
import type { MovementKind } from "./format";
import { DataError, recordMovements } from "./products";

export type OfflineItem = {
  client_id: string;
  product_id: string;
  kind: MovementKind;
  amount: number;
  at: string;
  source: "manual" | "voice";
  note?: string | null;
};

export type SyncResult = { sent: string[]; rejected: { client_id: string; reason: string }[] };

const KINDS: MovementKind[] = ["sale", "delivery", "adjustment"];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Записва записите, направени без интернет, един по един. Всеки има свой номер,
// така че повторно изпращане не записва нищо два пъти.
export async function syncOffline(items: unknown): Promise<SyncResult> {
  const result: SyncResult = { sent: [], rejected: [] };
  if (!Array.isArray(items)) return result;

  for (const raw of items.slice(0, 200) as Partial<OfflineItem>[]) {
    const clientId = String(raw?.client_id ?? "");
    if (!UUID.test(clientId)) continue;

    const at = new Date(String(raw.at));
    const amount = raw.amount;
    const valid =
      UUID.test(String(raw.product_id)) &&
      KINDS.includes(raw.kind as MovementKind) &&
      typeof amount === "number" &&
      Number.isFinite(amount) &&
      amount >= 0 &&
      amount <= 1_000_000 &&
      (raw.kind === "adjustment" || amount > 0) &&
      !Number.isNaN(at.getTime());
    if (!valid) {
      result.rejected.push({ client_id: clientId, reason: "Невалиден запис." });
      continue;
    }

    try {
      await recordMovements(
        [
          {
            product_id: String(raw.product_id),
            kind: raw.kind as MovementKind,
            amount: Math.round((amount as number) * 1000) / 1000,
            at: at.toISOString(),
            client_id: clientId,
            note: raw.note ? String(raw.note).slice(0, 500) : "Записано без интернет",
          },
        ],
        raw.source === "voice" ? "voice" : "manual",
        null,
      );
      result.sent.push(clientId);
    } catch (error) {
      if (error instanceof DataError) {
        result.rejected.push({ client_id: clientId, reason: error.message });
      } else {
        // Връзката с базата се губи — останалото ще се опита по-късно.
        break;
      }
    }
  }
  return result;
}
