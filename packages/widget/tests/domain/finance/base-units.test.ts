import { describe, expect, it } from "vitest";
import {
  fromBaseUnits,
  toBaseUnits,
} from "../../../src/domain/finance/base-units";
import { exactDecimal } from "../../../src/domain/finance/exact";

describe("fromBaseUnits", () => {
  it("reads base units as token units", () => {
    expect(fromBaseUnits(1_500_000n, 6).toFixed()).toBe("1.5");
    expect(fromBaseUnits(1n, 18).toFixed()).toBe("0.000000000000000001");
    expect(fromBaseUnits(1_000_000_000_000_000_001n, 18).toFixed()).toBe(
      "1.000000000000000001"
    );
  });

  it("keeps whole units for zero decimals", () => {
    expect(fromBaseUnits(42n, 0).toFixed()).toBe("42");
    expect(fromBaseUnits(0n, 18).isZero()).toBe(true);
  });
});

describe("toBaseUnits", () => {
  it("converts exact amounts identically in both rounding modes", () => {
    for (const rounding of ["round", "truncate"] as const) {
      expect(toBaseUnits(exactDecimal("1.5"), 6, rounding)).toBe(1_500_000n);
      expect(
        toBaseUnits(exactDecimal("1.000000000000000001"), 18, rounding)
      ).toBe(1_000_000_000_000_000_001n);
      expect(toBaseUnits(exactDecimal("42"), 0, rounding)).toBe(42n);
    }
  });

  it("truncates sub-unit excess toward zero", () => {
    expect(toBaseUnits(exactDecimal("1.9999999"), 6, "truncate")).toBe(
      1_999_999n
    );
    expect(toBaseUnits(exactDecimal("2.5"), 0, "truncate")).toBe(2n);
    expect(
      toBaseUnits(exactDecimal("0.0000000000000000019"), 18, "truncate")
    ).toBe(1n);
    expect(toBaseUnits(exactDecimal("-2.5"), 0, "truncate")).toBe(-2n);
  });

  it("rounds sub-unit excess half up", () => {
    expect(toBaseUnits(exactDecimal("1.9999999"), 6, "round")).toBe(2_000_000n);
    expect(toBaseUnits(exactDecimal("2.5"), 0, "round")).toBe(3n);
    expect(toBaseUnits(exactDecimal("2.4"), 0, "round")).toBe(2n);
    expect(
      toBaseUnits(exactDecimal("0.0000000000000000015"), 18, "round")
    ).toBe(2n);
    expect(toBaseUnits(exactDecimal("-2.5"), 0, "round")).toBe(-3n);
  });

  it("round-trips base units", () => {
    const raw = 123_456_789_012_345_678_901n;
    expect(toBaseUnits(fromBaseUnits(raw, 18), 18, "truncate")).toBe(raw);
  });
});
