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
  it.each([
    ["two decimals from 1,000", "167408.872592", "167,408.87"],
    ["four decimals from 1", "43.684851", "43.6848"],
    ["four significant digits below 1", "0.0123456789", "0.01234"],
    [
      "four significant digits near the dust floor",
      "0.0000012345",
      "0.000001234",
    ],
    ["an integer", "100", "100"],
    ["zero", "0", "0"],
    ["1 wei of an 18-decimal token", "0.000000000000000001", "<0.000001"],
    ["a negative amount toward zero", "-1234.5678", "-1,234.56"],
    ["negative dust", "-0.000000518744", ">-0.000001"],
  ])("rounds %s down", (_label, value, expected) => {
    expect(formatTokenAmount(value, "en", "down")).toBe(expected);
  });

  it.each([
    ["a minimum from 1,000", "167408.872592", "167,408.88"],
    ["a fee from 1", "43.684851", "43.6849"],
    ["a fee below 1", "0.0123456789", "0.01235"],
    ["across the 1,000 boundary", "999.99999", "1,000"],
    ["across the 1 boundary", "0.99999", "1"],
    ["an exact amount", "12.5", "12.5"],
    ["dust", "0.0000005", "<0.000001"],
  ])("rounds %s up", (_label, value, expected) => {
    expect(formatTokenAmount(value, "en", "up")).toBe(expected);
  });

  it.each([
    ["an estimate from 1,000", "148148.148147", "148,148.15"],
    ["an estimate below the half", "12438.47423", "12,438.47"],
    ["an estimate from 1", "1.23455", "1.2346"],
    ["an estimate below 1", "0.123449", "0.1234"],
  ])("rounds %s to nearest", (_label, value, expected) => {
    expect(formatTokenAmount(value, "en", "nearest")).toBe(expected);
  });

  it("uses the language separators", () => {
    expect(formatTokenAmount("167408.872592", "fr", "down")).toBe(
      `167${nnbsp}408,87`
    );
    expect(formatTokenAmount("0.000000000000000001", "fr", "down")).toBe(
      "<0,000001"
    );
  });

  it("formats values that cannot pass through JavaScript number", () => {
    expect(formatTokenAmount("9007199254740993.123456789", "en", "down")).toBe(
      "9,007,199,254,740,993.12"
    );
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
    ["en", 0.9996, "0.99"],
    ["en", 4.0828, "4.08"],
    ["en", 999.99999, "999.99"],
    ["en", 1000, "1K"],
    ["en", 2_228_355.9814, "2.22M"],
    ["en", "999999.999999999999", "999.99K"],
    ["en", null, "-"],
    ["fr", 0.0001, "<0,01"],
    ["fr", 4.0828, "4,08"],
    ["fr", 1234.5, `1,23${nbsp}k`],
  ] as const)(
    "formats %s health factor %s as %s",
    (locale, value, expected) => {
      expect(formatHealthFactor(value, locale)).toBe(expected);
    }
  );
});
