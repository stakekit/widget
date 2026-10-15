import BigNumber from "bignumber.js";
import { describe, expect, it } from "vitest";
import { exactDecimal } from "../../../src/domain/finance/exact";
import {
  formatCompactNumber,
  formatExactPercent,
  formatHealthFactor,
  formatLtv,
  formatNumber,
  formatPercent,
  formatRewardRatePercent,
  formatRoundedPercent,
  formatTokenAmount,
  formatUsd,
} from "../../../src/shared/lib/number-format";

// French separators: U+202F groups digits, U+00A0 precedes `%` and `$`.
const nnbsp = "\u202f";
const nbsp = "\u00a0";

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
    ["a negative grouped value", "-1234.5678", 2, "-1,234.56"],
  ])("formats %s in English", (_label, value, decimals, expected) => {
    expect(formatNumber(value, "en", decimals)).toBe(expected);
  });

  it.each([
    [
      "a grouped value truncated down",
      "1234.5678919",
      6,
      `1${nnbsp}234,567891`,
    ],
    ["dust at six decimals", "0.000000518744", 6, "<0,000001"],
    ["negative dust", "-0.000000518744", 6, ">-0,000001"],
    ["a negative grouped value", "-1234.5678", 2, `-1${nnbsp}234,56`],
    ["zero", "0", 6, "0"],
  ])("formats %s in French", (_label, value, decimals, expected) => {
    expect(formatNumber(value, "fr", decimals)).toBe(expected);
  });

  it("keeps the exact value when no precision is requested", () => {
    expect(formatNumber(new BigNumber("0.000000000000000001"), "en")).toBe(
      "0.000000000000000001"
    );
    expect(formatNumber("1234567.000000000000000001", "fr")).toBe(
      `1${nnbsp}234${nnbsp}567,000000000000000001`
    );
  });

  it("formats values that cannot pass through JavaScript number", () => {
    const amount = exactDecimal("9007199254740993.123456789");

    expect(formatNumber(amount, "en", 6)).toBe("9,007,199,254,740,993.123456");
    expect(formatNumber(amount, "fr", 6)).toBe(
      `9${nnbsp}007${nnbsp}199${nnbsp}254${nnbsp}740${nnbsp}993,123456`
    );
  });
});

describe("formatTokenAmount", () => {
  it("truncates to six decimals and marks dust in each language", () => {
    expect(formatTokenAmount("0.000000000000000001", "en")).toBe("<0.000001");
    expect(formatTokenAmount("0.000000000000000001", "fr")).toBe("<0,000001");
    expect(formatTokenAmount("12.3456789", "en")).toBe("12.345678");
    expect(formatTokenAmount("12.3456789", "fr")).toBe("12,345678");
  });
});

describe("formatUsd", () => {
  it.each([
    [null, "-"],
    [Number.NaN, "-"],
    [0, "$0.00"],
    [0.004, "<$0.01"],
    [-0.004, ">-$0.01"],
    [0.01, "$0.01"],
    [0.5, "$0.50"],
    [2.54, "$2.54"],
    [999.99, "$999.99"],
    [1000, "$1K"],
    [1250, "$1.25K"],
    [4_100_000, "$4.1M"],
    [-1250, "-$1.25K"],
    [exactDecimal("9007199254740993.123456789"), "$9007.2T"],
  ])("formats %s as %s in English", (value, expected) => {
    expect(formatUsd(value, "en")).toBe(expected);
  });

  it.each([
    [null, "-"],
    [0, `0,00${nbsp}$`],
    [0.004, `<0,01${nbsp}$`],
    [-0.004, `>-0,01${nbsp}$`],
    [2.54, `2,54${nbsp}$`],
    [1250, `1,25${nbsp}k${nbsp}$`],
    [-1250, `-1,25${nbsp}k${nbsp}$`],
  ])("formats %s as %s in French", (value, expected) => {
    expect(formatUsd(value, "fr")).toBe(expected);
  });
});

describe("formatCompactNumber", () => {
  it.each([
    ["en", 999, "999"],
    ["en", 1234, "1K"],
    ["en", 4_100_000, "4M"],
    ["fr", 1234, `1${nbsp}k`],
    ["fr", 4_100_000, `4${nbsp}M`],
    ["fr", null, "-"],
  ] as const)("formats %s %s as %s", (locale, value, expected) => {
    expect(formatCompactNumber(value, locale)).toBe(expected);
  });
});

describe("formatPercent", () => {
  it.each([
    [null, "-"],
    [undefined, "-"],
    ["", "-"],
    [Number.NaN, "-"],
    [0, "0%"],
    [0.075, "7.5%"],
    [0.7523, "75.23%"],
    [0.75239, "75.23%"],
    ["0.5", "50%"],
    [0.00004, "<0.01%"],
    [-0.0525, "-5.25%"],
  ])("formats ratio %s as %s in English", (value, expected) => {
    expect(formatPercent(value, "en")).toBe(expected);
  });

  it.each([
    [0.7523, `75,23${nbsp}%`],
    [0.00004, `<0,01${nbsp}%`],
    [-0.0525, `-5,25${nbsp}%`],
    [null, "-"],
  ])("formats ratio %s as %s in French", (value, expected) => {
    expect(formatPercent(value, "fr")).toBe(expected);
  });

  it("rounds reward-style percentages to two places", () => {
    expect(formatRoundedPercent(0.123456, "en")).toBe("12.35%");
    expect(formatRoundedPercent(0.123456, "fr")).toBe(`12,35${nbsp}%`);
    expect(formatRoundedPercent(12.5, "en")).toBe("1,250%");
  });

  it("shows fee percentages exactly, without rounding", () => {
    expect(formatExactPercent("0.00125", "en")).toBe("0.125%");
    expect(formatExactPercent("0.00125", "fr")).toBe(`0,125${nbsp}%`);
    expect(formatExactPercent(exactDecimal("12.345678"), "en")).toBe(
      "1,234.5678%"
    );
  });
});

describe("formatRewardRatePercent", () => {
  it("treats a missing or zero reward rate as unknown", () => {
    expect(formatRewardRatePercent(0, "en")).toBe("- %");
    expect(formatRewardRatePercent(exactDecimal(0), "en")).toBe("- %");
    expect(formatRewardRatePercent(undefined, "fr")).toBe("- %");
  });

  it("formats the reward rate in each language", () => {
    expect(formatRewardRatePercent(0.05, "en")).toBe("5%");
    expect(formatRewardRatePercent(exactDecimal("0.0525"), "fr")).toBe(
      `5,25${nbsp}%`
    );
  });
});

describe("formatLtv", () => {
  it.each([
    ["en", null, "-"],
    ["en", 0.4132, "41.32%"],
    ["en", 1, "100%"],
    ["en", 1.0001, ">100%"],
    ["en", 4116.7807, ">100%"],
    ["fr", 0.4132, `41,32${nbsp}%`],
    ["fr", 1.0001, `>100${nbsp}%`],
  ] as const)("formats %s LTV %s as %s", (locale, value, expected) => {
    expect(formatLtv(value, locale)).toBe(expected);
  });
});

describe("formatHealthFactor", () => {
  it.each([
    ["en", 0, "0"],
    ["en", 0.0001, "<0.01"],
    ["en", 0.0099, "<0.01"],
    ["en", 0.01, "0.01"],
    ["en", 0.9876, "0.9876"],
    ["en", 4.37089, "4.3708"],
    ["en", null, "-"],
    ["fr", 0.0001, "<0,01"],
    ["fr", 4.37089, "4,3708"],
    ["fr", 1234.5, `1${nnbsp}234,5`],
  ] as const)(
    "formats %s health factor %s as %s",
    (locale, value, expected) => {
      expect(formatHealthFactor(value, locale)).toBe(expected);
    }
  );
});
