import { describe, expect, it } from "vitest";
import { clean } from "@/lib/understand";
import type { Product } from "@/lib/products";

const product = (id: string, name: string, unit = "бут."): Product => ({
  id,
  name,
  unit,
  quantity: 10,
  min_quantity: 2,
  supplier: null,
  pack_size: null,
  price: null,
  aliases: [],
});

const products = [product("a", "Олио 1 л"), product("b", "Олио 2 л"), product("c", "Хляб", "бр.")];

const item = {
  kind: "sale" as const,
  amount: 1,
  said: "",
  product_id: "",
  options: [] as string[],
  question: "",
  new_name: "",
  unit: "бр." as const,
};

describe("clean", () => {
  it("пази само познати продукти", () => {
    const result = clean({ items: [{ ...item, product_id: "c" }, { ...item, product_id: "zzz" }], reply: "" }, products);
    expect(result.items[0].product_id).toBe("c");
    expect(result.items[0].unit).toBe("бр.");
    expect(result.items[1].product_id).toBeNull();
  });

  it("маха непознати варианти и избира единствения останал", () => {
    const result = clean({ items: [{ ...item, options: ["a", "zzz"] }], reply: "" }, products);
    expect(result.items[0].product_id).toBe("a");
    expect(result.items[0].options).toEqual([]);
  });

  it("оставя въпроса, когато има няколко варианта", () => {
    const result = clean(
      { items: [{ ...item, options: ["a", "b"], question: "Олио 1 л или 2 л?" }], reply: "" },
      products,
    );
    expect(result.items[0].product_id).toBeNull();
    expect(result.items[0].options).toEqual(["a", "b"]);
    expect(result.items[0].question).toBe("Олио 1 л или 2 л?");
  });

  it("изхвърля отрицателни и безумни количества", () => {
    const result = clean(
      { items: [{ ...item, product_id: "c", amount: -3 }, { ...item, product_id: "c", amount: 1e9 }], reply: "" },
      products,
    );
    expect(result.items).toHaveLength(0);
  });

  it("предлага нов продукт само когато няма съвпадение", () => {
    const result = clean({ items: [{ ...item, new_name: "Сол 1 кг", unit: "бр." }], reply: "" }, products);
    expect(result.items[0].new_name).toBe("Сол 1 кг");
  });
});
