import { describe, expect, it } from "vitest";
import { NO_SUPPLIER, groupBySupplier, orderMessage, suggestedAmount } from "@/lib/order";

const base = { id: "1", name: "Олио", unit: "бут.", supplier: "Метро", pack_size: null };

describe("suggestedAmount", () => {
  it("допълва до два пъти минимума", () => {
    expect(suggestedAmount({ ...base, quantity: 2, min_quantity: 5 })).toBe(8);
  });

  it("поръчва поне 1", () => {
    expect(suggestedAmount({ ...base, quantity: 20, min_quantity: 5 })).toBe(1);
  });

  it("закръгля нагоре до цели кашони", () => {
    expect(suggestedAmount({ ...base, quantity: 0, min_quantity: 3, pack_size: 6 })).toBe(6);
    expect(suggestedAmount({ ...base, quantity: 1, min_quantity: 10, pack_size: 6 })).toBe(24);
  });

  it("закръгля дробни количества нагоре", () => {
    expect(suggestedAmount({ ...base, quantity: 1.2, min_quantity: 1.5 })).toBe(2);
  });
});

describe("groupBySupplier", () => {
  it("групира и слага продуктите без доставчик накрая", () => {
    const groups = groupBySupplier([
      { name: "Сирене", supplier: "Млекарна" },
      { name: "Сол", supplier: null },
      { name: "Олио", supplier: "Метро" },
      { name: "Бира", supplier: "Метро" },
    ]);
    expect(groups.map((g) => g.supplier)).toEqual(["Метро", "Млекарна", NO_SUPPLIER]);
    expect(groups[0].products.map((p) => p.name)).toEqual(["Бира", "Олио"]);
  });
});

describe("orderMessage", () => {
  it("прави готов текст за изпращане", () => {
    const text = orderMessage(
      [{ id: "1", name: "Олио 1 л", unit: "бут.", amount: 12 }],
      "Метро",
      "Магазин Здравец",
      String,
    );
    expect(text).toBe(
      "Здравейте, Метро!\nПоръчка от Магазин Здравец:\n\n1. Олио 1 л — 12 бут.\n\nБлагодаря!",
    );
  });
});
