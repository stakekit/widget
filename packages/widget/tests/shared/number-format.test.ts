import BigNumber from "bignumber.js";
import { describe, expect, it } from "vitest";
import {
  defaultFormattedNumber,
  formatNumber,
} from "../../src/shared/lib/number-format";

describe("formatNumber", () => {
  it.each([
    ["1 wei of an 18-decimal token", "0.000000000000000001", 6, "<0.000001"],
    ["sub-unit ETH dust", "0.000000518744", 6, "<0.000001"],
    ["a value at the display precision", "0.000015", 6, "0.000015"],
    ["a grouped value truncated down", "1234.5678919", 6, "1,234.567891"],
    ["zero", "0", 6, "0"],
    ["dust at two decimals", "0.004", 2, "<0.01"],
    ["dust at four decimals", "0.00004", 4, "<0.0001"],
    ["negative dust", "-0.000000518744", 6, ">-0.000001"],
  ])("formats %s", (_label, value, decimals, expected) => {
    expect(formatNumber(value, decimals)).toBe(expected);
  });

  it("keeps the exact value when no precision is requested", () => {
    expect(formatNumber(new BigNumber("0.000000000000000001"))).toBe(
      "0.000000000000000001"
    );
  });

  it("renders dust below one display unit in the default format", () => {
    expect(defaultFormattedNumber("0.000000000000000001")).toBe("<0.000001");
  });
});
