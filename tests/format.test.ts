import { describe, expect, it } from "vitest";
import { formatMoney, formatQty, parseMoney, parseQty } from "@/lib/format";

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
    expect(parseQty("1e5")).toBeNull();
    expect(parseQty("0x10")).toBeNull();
    expect(parseQty("1,2,3")).toBeNull();
  });

  it("закръгля до грам", () => {
    expect(parseQty("0,12345")).toBe(0.123);
    expect(parseQty("1,0005")).toBe(1.001);
  });
});

describe("formatQty", () => {
  it("пише с българска запетая", () => {
    expect(formatQty(7.5)).toBe("7,5");
    expect(formatQty(3)).toBe("3");
  });
});

describe("parseMoney / formatMoney", () => {
  it("приема цени с запетая, точка и знак за евро", () => {
    expect(parseMoney("2,40")).toBe(2.4);
    expect(parseMoney("2.4 €")).toBe(2.4);
    expect(parseMoney("1,005")).toBe(1.01);
  });

  it("отхвърля празно и нечисла", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("две")).toBeNull();
    expect(parseMoney("-1")).toBeNull();
    expect(parseMoney("1e2")).toBeNull();
  });

  it("пише сума в евро", () => {
    expect(formatMoney(9)).toBe("9,00\u00a0€");
  });
});
