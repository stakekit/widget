import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  exactDecimal,
  toSafeIntegerCount,
} from "../../src/domain/finance/exact";
import {
  ExactBaseUnitAmount,
  ExactDecimal,
} from "../../src/domain/finance/scalars";

describe("exact finance schemas", () => {
  it("decodes string and number decimals into equal BigNumber values", () => {
    const fromString = Schema.decodeSync(ExactDecimal)("1.5");
    const fromNumber = Schema.decodeSync(ExactDecimal)(1.5);

    expect(BigNumber.isBigNumber(fromString)).toBe(true);
    expect(fromString.isEqualTo(fromNumber)).toBe(true);
    expect(Schema.encodeSync(ExactDecimal)(fromString)).toBe("1.5");
  });

  it("preserves decimal precision that cannot pass through JavaScript number", () => {
    const value = Schema.decodeSync(ExactDecimal)(
      "9007199254740993.000000000000000001"
    );

    expect(value.toFixed()).toBe("9007199254740993.000000000000000001");
    expect(value.isEqualTo("9007199254740993.000000000000000001")).toBe(true);
  });

  it("rejects non-finite decimal inputs", () => {
    expect(() => Schema.decodeSync(ExactDecimal)("NaN")).toThrow();
    expect(() => Schema.decodeSync(ExactDecimal)(Number.NaN)).toThrow();
    expect(() =>
      Schema.decodeSync(ExactDecimal)(Number.POSITIVE_INFINITY)
    ).toThrow();
  });

  it("decodes Base Unit Amounts from string or number into bigint", () => {
    expect(Schema.decodeSync(ExactBaseUnitAmount)("12")).toBe(12n);
    expect(Schema.decodeSync(ExactBaseUnitAmount)(12)).toBe(12n);
    expect(Schema.decodeSync(ExactBaseUnitAmount)("1000000000000000001")).toBe(
      1000000000000000001n
    );
    expect(Schema.encodeSync(ExactBaseUnitAmount)(12n)).toBe("12");
  });

  it("rejects non-integer Base Unit Amount inputs", () => {
    expect(() => Schema.decodeSync(ExactBaseUnitAmount)("1.5")).toThrow();
    expect(() => Schema.decodeSync(ExactBaseUnitAmount)(1.5)).toThrow();
    expect(() =>
      Schema.decodeSync(ExactBaseUnitAmount)(9_007_199_254_740_992)
    ).toThrow();
  });

  it("divides with 20 decimal places and half-up rounding", () => {
    expect(new BigNumber(1).dividedBy(3).toFixed()).toBe(
      "0.33333333333333333333"
    );
    expect(new BigNumber(2).dividedBy(3).toFixed()).toBe(
      "0.66666666666666666667"
    );
  });

  it("converts integer counts without using JavaScript number until the value is a safe integer", () => {
    expect(toSafeIntegerCount(exactDecimal(3))).toBe(3);
    expect(toSafeIntegerCount(exactDecimal("1.5"))).toBeNull();
    expect(toSafeIntegerCount(exactDecimal("9007199254740993"))).toBeNull();
  });
});
