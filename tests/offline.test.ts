import { describe, expect, it } from "vitest";
import { estimateQuantity, type QueueItem } from "@/lib/offline-queue";

const bread = { id: "b", name: "Хляб", unit: "бр.", quantity: 10 };

function item(kind: QueueItem["kind"], amount: number, productId = "b"): QueueItem {
  return {
    client_id: `${kind}-${amount}`,
    product_id: productId,
    name: "Хляб",
    unit: "бр.",
    kind,
    amount,
    at: "2026-09-24T10:00:00Z",
    source: "manual",
    note: null,
  };
}

describe("estimateQuantity", () => {
  it("прилага чакащите записи по ред", () => {
    const queue = [item("sale", 3), item("delivery", 5), item("sale", 1, "other")];
    expect(estimateQuantity(bread, queue)).toBe(12);
  });

  it("корекцията задава точното число", () => {
    expect(estimateQuantity(bread, [item("sale", 3), item("adjustment", 4), item("sale", 1)])).toBe(3);
  });

  it("без чакащи записи връща запазеното", () => {
    expect(estimateQuantity(bread, [])).toBe(10);
  });
});
