import { describe, expect, it } from "vitest";
import { formatQty, parseQty } from "@/lib/format";

describe("parseQty", () => {
  it("приема запетая и точка", () => {
    expect(parseQty("1,5")).toBe(1.5);
    expect(parseQty("2.25")).toBe(2.25);
    expect(parseQty(" 12 ")).toBe(12);
  });

  it("отхвърля празно, отрицателно и нечисла", () => {
    expect(parseQty("")).toBeNull();
    expect(parseQty("-1")).toBeNull();
    expect(parseQty("abc")).toBeNull();
    expect(parseQty(null)).toBeNull();
  });

  it("закръгля до грам", () => {
    expect(parseQty("0,12345")).toBe(0.123);
  });
});

describe("formatQty", () => {
  it("пише с българска запетая", () => {
    expect(formatQty(7.5)).toBe("7,5");
    expect(formatQty(3)).toBe("3");
  });
});
