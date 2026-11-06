import BigNumber from "bignumber.js";
import { describe, expect, it } from "vitest";
import { exactDecimal } from "../../../src/domain/finance/exact";
import {
  formatCompactNumber,
  formatExactPercent,
  formatFigureChange,
  formatHealthFactor,
  formatLtv,
  formatNumber,
  formatPercent,
  formatPercentAxis,
  formatRewardRatePercent,
  formatRoundedPercent,
  formatTokenAmount,
  formatTokenAmountWithSymbol,
  formatUsd,
  formatUsdAxis,
  getRoundedPercentParts,
  unavailableFigure,
  withFigureUnit,
} from "../../../src/shared/lib/number-format";

// French separators: U+202F groups digits, U+00A0 precedes `%` and `$`.
const nnbsp = "\u202f";
const nbsp = "\u00a0";
// Negative figures read with the minus sign, not the hyphen-minus.
const minus = "\u2212";

describe("formatNumber", () => {
  it.each([
    ["1 wei of an 18-decimal token", "0.000000000000000001", 6, "<0.000001"],
    ["sub-unit ETH dust", "0.000000518744", 6, "<0.000001"],
    ["a value at the display precision", "0.000015", 6, "0.000015"],
    ["a grouped value truncated down", "1234.5678919", 6, "1,234.567891"],
    ["zero", "0", 6, "0"],
    ["dust at two decimals", "0.004", 2, "<0.01"],
    ["dust at four decimals", "0.00004", 4, "<0.0001"],
    ["negative dust", "-0.000000518744", 6, `>${minus}0.000001`],
    ["a negative grouped value", "-1234.5678", 2, `${minus}1,234.56`],
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
    ["negative dust", "-0.000000518744", 6, `>${minus}0,000001`],
    ["a negative grouped value", "-1234.5678", 2, `${minus}1${nnbsp}234,56`],
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
    ["four decimals from 1,000", "167408.872592", "167,408.8725"],
    ["four decimals from 1", "43.684851", "43.6848"],
    ["four decimals below 1", "0.0123456789", "0.0123"],
    ["the smallest four-decimal amount", "0.00019", "0.0001"],
    ["an integer", "100", "100"],
    ["zero", "0", "0"],
    ["an amount that would read 0", "0.0000025", "<0.0001"],
    ["1 wei of an 18-decimal token", "0.000000000000000001", "<0.0001"],
    ["a negative amount toward zero", "-1234.5678", `${minus}1,234.5678`],
    ["negative dust", "-0.000000518744", `>${minus}0.0001`],
  ])("rounds %s down", (_label, value, expected) => {
    expect(formatTokenAmount(value, "en", "down")).toBe(expected);
  });

  it.each([
    ["a minimum from 1,000", "167408.872592", "167,408.8726"],
    ["a fee from 1", "43.684851", "43.6849"],
    ["a fee below 1", "0.0123456789", "0.0124"],
    ["across the 1,000 boundary", "999.99999", "1,000"],
    ["across the 1 boundary", "0.99999", "1"],
    ["an exact amount", "12.5", "12.5"],
    ["a fee below the smallest unit", "0.00007445", "<0.0001"],
  ])("rounds %s up", (_label, value, expected) => {
    expect(formatTokenAmount(value, "en", "up")).toBe(expected);
  });

  it.each([
    ["an estimate from 1,000", "148148.148147", "148,148.1481"],
    ["an estimate below the half", "12438.474249", "12,438.4742"],
    ["an estimate from 1", "1.23455", "1.2346"],
    ["an estimate below 1", "0.123449", "0.1234"],
    ["an estimate that would read 0", "0.0000025", "<0.0001"],
  ])("rounds %s to nearest", (_label, value, expected) => {
    expect(formatTokenAmount(value, "en", "nearest")).toBe(expected);
  });

  it("uses the language separators", () => {
    expect(formatTokenAmount("167408.872592", "fr", "down")).toBe(
      `167${nnbsp}408,8725`
    );
    expect(formatTokenAmount("0.000000000000000001", "fr", "down")).toBe(
      "<0,0001"
    );
    expect(formatTokenAmount("-0.5", "fr", "down")).toBe(`${minus}0,5`);
  });

  it("groups amounts in full below 1,000,000", () => {
    expect(formatTokenAmount("1762.34567", "en", "down")).toBe("1,762.3456");
    expect(formatTokenAmount("999999.99991", "en", "down")).toBe(
      "999,999.9999"
    );
  });

  it.each([
    ["millions", "1200000", "down", "1.2M"],
    ["millions rounded down", "12345678.9", "down", "12.34M"],
    ["millions rounded up", "12345678.9", "up", "12.35M"],
    ["across the 1,000,000 boundary", "999999.99999", "up", "1M"],
    ["billions", "9876543210.12", "down", "9.87B"],
    ["a negative amount", "-211000000", "down", `${minus}211M`],
  ] as const)(
    "shows %s compactly from 1,000,000",
    (_label, value, rounding, expected) => {
      expect(formatTokenAmount(value, "en", rounding)).toBe(expected);
    }
  );

  it("uses the language's compact notation", () => {
    expect(formatTokenAmount("1234567.8", "fr", "down")).toBe(`1,23${nbsp}M`);
  });

  it("follows the amount with its token's symbol", () => {
    expect(
      formatTokenAmountWithSymbol(
        { amount: "211000000", token: { symbol: "USDC" } },
        "en"
      )
    ).toBe("211M USDC");
  });
});

describe("formatUsd", () => {
  it.each([
    [null, "—"],
    [Number.NaN, "—"],
    [0, "$0.00"],
    [0.004, "<$0.01"],
    [-0.004, `>${minus}$0.01`],
    [0.01, "$0.01"],
    [0.5, "$0.50"],
    [2.54, "$2.54"],
    [999.99, "$999.99"],
    [1000, "$1,000.00"],
    [1500, "$1,500.00"],
    [1710.4249, "$1,710.42"],
    [999_999.99, "$999,999.99"],
    [999_999.996, "$1M"],
    [1_230_000, "$1.23M"],
    [4_100_000, "$4.1M"],
    [-1250, `${minus}$1,250.00`],
    [exactDecimal("9007199254740993.123456789"), "$9007.2T"],
  ])("formats %s as %s in English", (value, expected) => {
    expect(formatUsd(value, "en")).toBe(expected);
  });

  it.each([
    [null, "—"],
    [0, `0,00${nbsp}$`],
    [0.004, `<0,01${nbsp}$`],
    [-0.004, `>${minus}0,01${nbsp}$`],
    [2.54, `2,54${nbsp}$`],
    [1250, `1${nnbsp}250,00${nbsp}$`],
    [1_250_000, `1,25${nbsp}M${nbsp}$`],
    [-1250, `${minus}1${nnbsp}250,00${nbsp}$`],
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
    ["fr", null, "—"],
  ] as const)("formats %s %s as %s", (locale, value, expected) => {
    expect(formatCompactNumber(value, locale)).toBe(expected);
  });
});

describe("formatPercent", () => {
  it.each([
    [null, "—"],
    [undefined, "—"],
    ["", "—"],
    [Number.NaN, "—"],
    [0, "0%"],
    [0.075, "7.5%"],
    [0.7523, "75.23%"],
    [0.75239, "75.23%"],
    ["0.5", "50%"],
    [0.00004, "<0.01%"],
    [-0.0525, `${minus}5.25%`],
  ])("formats ratio %s as %s in English", (value, expected) => {
    expect(formatPercent(value, "en")).toBe(expected);
  });

  it.each([
    [0.7523, `75,23${nbsp}%`],
    [0.00004, `<0,01${nbsp}%`],
    [-0.0525, `${minus}5,25${nbsp}%`],
    [null, "—"],
  ])("formats ratio %s as %s in French", (value, expected) => {
    expect(formatPercent(value, "fr")).toBe(expected);
  });

  it("rounds reward-style percentages to two places", () => {
    expect(formatRoundedPercent(0.123456, "en")).toBe("12.35%");
    expect(formatRoundedPercent(0.123456, "fr")).toBe(`12,35${nbsp}%`);
    expect(formatRoundedPercent(12.5, "en")).toBe("1,250%");
  });

  it("never reads an existing rate as 0%", () => {
    expect(formatRoundedPercent(0.000_04, "en")).toBe("<0.01%");
    expect(formatRoundedPercent(0.000_04, "fr")).toBe(`<0,01${nbsp}%`);
    expect(formatRoundedPercent(-0.000_04, "en")).toBe(`>${minus}0.01%`);
    expect(formatRoundedPercent(0, "en")).toBe("0%");
  });

  it("shows fee percentages exactly, without rounding", () => {
    expect(formatExactPercent("0.00125", "en")).toBe("0.125%");
    expect(formatExactPercent("0.00125", "fr")).toBe(`0,125${nbsp}%`);
    expect(formatExactPercent(exactDecimal("12.345678"), "en")).toBe(
      "1,234.5678%"
    );
  });
});

describe("getRoundedPercentParts", () => {
  it("keeps the affixes apart and every step to the target's places", () => {
    const parts = getRoundedPercentParts(0.062, "en");
    expect(parts).toMatchObject({ prefix: "", suffix: "%" });
    expect([0, 0.048, 0.0573, 0.062].map(parts.format)).toEqual([
      "0.0",
      "4.8",
      "5.7",
      "6.2",
    ]);
  });

  it("reads the last step exactly as formatRoundedPercent", () => {
    const parts = getRoundedPercentParts(0.123456, "fr");
    expect(`${parts.prefix}${parts.format(0.123456)}${parts.suffix}`).toBe(
      formatRoundedPercent(0.123456, "fr")
    );
    expect(parts.format(0.05)).toBe("5,00");
    expect(getRoundedPercentParts(0.05, "en").format(0.0123)).toBe("1");
  });
});

describe("formatRewardRatePercent", () => {
  it("treats a missing or zero reward rate as unknown", () => {
    expect(formatRewardRatePercent(0, "en")).toBe("—");
    expect(formatRewardRatePercent(exactDecimal(0), "en")).toBe("—");
    expect(formatRewardRatePercent(undefined, "fr")).toBe("—");
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
    ["en", null, "—"],
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
    ["en", null, "—"],
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

describe("withFigureUnit", () => {
  it("follows a figure with its unit", () => {
    expect(withFigureUnit("1.5", "ETH")).toBe("1.5 ETH");
    expect(withFigureUnit("1.5 → 1", "USDC")).toBe("1.5 → 1 USDC");
  });

  it("reads an unknown figure as the placeholder alone, without the unit", () => {
    expect(withFigureUnit(null, "ETH")).toBe(unavailableFigure);
    expect(withFigureUnit(undefined, "ETH")).toBe(unavailableFigure);
    expect(withFigureUnit(unavailableFigure, "ETH")).toBe(unavailableFigure);
  });
});

describe("formatFigureChange", () => {
  it("joins a changed figure with an arrow", () => {
    expect(
      formatFigureChange(formatPercent, { before: 0.3791, after: 0.42 }, "en")
    ).toBe("37.91% → 42%");
  });

  it("shows just the figure when it does not change or before is unknown", () => {
    expect(
      formatFigureChange(formatPercent, { before: 0.42, after: 0.42 }, "en")
    ).toBe("42%");
    expect(
      formatFigureChange(formatPercent, { before: null, after: 0.42 }, "en")
    ).toBe("42%");
  });

  it("keeps an unchanged figure's arrow when asked to", () => {
    expect(
      formatFigureChange(formatPercent, { before: 0.42, after: 0.42 }, "en", {
        showWhenEqual: true,
      })
    ).toBe("42% → 42%");
    expect(
      formatFigureChange(formatPercent, { before: null, after: 0.42 }, "en", {
        showWhenEqual: true,
      })
    ).toBe("42%");
  });

  it("formats an unavailable figure to null", () => {
    expect(
      formatFigureChange(formatPercent, { before: 0.1, after: null }, "en")
    ).toBeNull();
  });
});

describe("formatPercentAxis", () => {
  it("gives every tick the decimals that place it near its tick", () => {
    expect(formatPercentAxis([0.056, 0.064_75, 0.0735], "en")).toEqual([
      "5.6%",
      "6.5%",
      "7.4%",
    ]);
    expect(formatPercentAxis([0, 0.05, 0.1], "en")).toEqual([
      "0%",
      "5%",
      "10%",
    ]);
    expect(formatPercentAxis([0.0401, 0.0403, 0.0405], "en")).toEqual([
      "4.01%",
      "4.03%",
      "4.05%",
    ]);
  });

  it("uses the language separators and affixes", () => {
    expect(formatPercentAxis([0.056, 0.064_75, 0.0735], "fr")).toEqual([
      `5,6${nbsp}%`,
      `6,5${nbsp}%`,
      `7,4${nbsp}%`,
    ]);
    expect(formatPercentAxis([-0.05, 0, 0.05], "en")).toEqual([
      `${minus}5%`,
      "0%",
      "5%",
    ]);
  });

  it("keeps labels near ticks the chart pads off whole numbers", () => {
    expect(formatPercentAxis([0.061_405, 0.068_45, 0.075_495], "en")).toEqual([
      "6.1%",
      "6.8%",
      "7.5%",
    ]);
  });
});

describe("formatUsdAxis", () => {
  it("shows every tick in the largest tick's compact unit", () => {
    expect(formatUsdAxis([593.57, 1190, 1790], "en")).toEqual([
      "$0.6K",
      "$1.2K",
      "$1.8K",
    ]);
    expect(
      formatUsdAxis([1_250_000_000, 1_800_000_000, 2_350_000_000], "en")
    ).toEqual(["$1.3B", "$1.8B", "$2.4B"]);
  });

  it("shows small values as plain USD with one decimal count", () => {
    expect(formatUsdAxis([0, 25.5, 51], "en")).toEqual(["$0", "$26", "$51"]);
    expect(formatUsdAxis([0.1, 0.15, 0.2], "en")).toEqual([
      "$0.10",
      "$0.15",
      "$0.20",
    ]);
  });

  it("uses the language's currency and compact affixes", () => {
    expect(formatUsdAxis([593.57, 1190, 1790], "fr")).toEqual([
      `0,6${nbsp}k${nbsp}$`,
      `1,2${nbsp}k${nbsp}$`,
      `1,8${nbsp}k${nbsp}$`,
    ]);
  });
});
