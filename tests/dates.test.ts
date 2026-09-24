import { describe, expect, it } from "vitest";
import { startOfDay, startOfWeek } from "@/lib/dates";

describe("българско време", () => {
  it("денят започва в полунощ София (лятно време, UTC+3)", () => {
    const now = new Date("2026-09-24T10:00:00Z");
    expect(startOfDay(now).toISOString()).toBe("2026-09-23T21:00:00.000Z");
  });

  it("денят започва в полунощ София (зимно време, UTC+2)", () => {
    const now = new Date("2026-01-15T23:30:00Z"); // вече 16 януари в София
    expect(startOfDay(now).toISOString()).toBe("2026-01-15T22:00:00.000Z");
  });

  it("седмицата започва в понеделник", () => {
    const thursday = new Date("2026-09-24T10:00:00Z");
    expect(startOfWeek(thursday).toISOString()).toBe("2026-09-20T21:00:00.000Z");
    const sunday = new Date("2026-09-27T18:00:00Z");
    expect(startOfWeek(sunday).toISOString()).toBe("2026-09-20T21:00:00.000Z");
    const monday = new Date("2026-09-21T05:00:00Z");
    expect(startOfWeek(monday).toISOString()).toBe("2026-09-20T21:00:00.000Z");
  });
});
