import { describe, expect, it } from "vitest";
import { exactDecimal } from "../../src/domain/finance/exact";
import {
  formatBorrowProviderName,
  formatHealthFactor,
  formatNetworkName,
  formatPercent,
  formatUsd,
  getRewardRateFormatted,
  humanizeEnumValue,
} from "../../src/shared/lib/formatters";
import { formatNumber } from "../../src/shared/lib/number-format";

describe("shared formatters", () => {
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
  ])("formats USD value %s as %s", (value, expected) => {
    expect(formatUsd(value)).toBe(expected);
  });

  it.each([
    [null, "-"],
    [undefined, "-"],
    ["", "-"],
    [Number.NaN, "-"],
    [0, "0%"],
    [0.075, "7.5%"],
    [0.7523, "75.23%"],
    ["0.5", "50%"],
  ])("formats percent value %s as %s", (value, expected) => {
    expect(formatPercent(value)).toBe(expected);
  });

  it("formats shared borrow presentation values", () => {
    expect(formatHealthFactor(4.3708)).toBe("4.3708");
    expect(formatHealthFactor(2.125)).toBe("2.125");
    expect(formatHealthFactor(4.37)).toBe("4.37");
    expect(formatNetworkName("ethereum")).toBe("Ethereum");
    expect(formatNetworkName("arbitrum-one")).toBe("Arbitrum One");
    expect(formatBorrowProviderName("Morpho Blue Borrow")).toBe("Morpho Blue");
    expect(formatBorrowProviderName("Aave V3")).toBe("Aave V3");
  });

  it("treats a zero BigNumber reward rate as missing", () => {
    expect(getRewardRateFormatted({ rewardRate: 0 })).toBe("- %");
    expect(getRewardRateFormatted({ rewardRate: exactDecimal(0) })).toBe("- %");
    expect(getRewardRateFormatted({ rewardRate: undefined })).toBe("- %");
    expect(getRewardRateFormatted({ rewardRate: 0.05 })).toBe("5%");
    expect(getRewardRateFormatted({ rewardRate: exactDecimal("0.05") })).toBe(
      "5%"
    );
  });

  it("formats token and fiat values that cannot pass through JavaScript number", () => {
    const amount = exactDecimal("9007199254740993.123456789");

    expect(formatNumber(amount, 6)).toBe("9,007,199,254,740,993.123456");
    expect(formatUsd(amount)).toBe("$9007.2T");
  });

  it("humanizes enum-like values", () => {
    expect(humanizeEnumValue("block")).toBe("Block");
    expect(humanizeEnumValue("WITHDRAWAL_REQUEST")).toBe("Withdrawal Request");
    expect(humanizeEnumValue("FOO__BAR")).toBe("Foo Bar");
  });
});
