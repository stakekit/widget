import BigNumber from "bignumber.js";
import { describe, expect, it } from "vitest";
import { isFundedBalance } from "../../../src/domain/finance/funded-balance";

describe("isFundedBalance", () => {
  it("treats a 1-wei balance as dust with or without a price", () => {
    expect(
      isFundedBalance({
        amount: new BigNumber("0.000000000000000001"),
        priceUsd: null,
      })
    ).toBe(false);
    expect(
      isFundedBalance({
        amount: new BigNumber("0.000000000000000001"),
        priceUsd: new BigNumber(3000),
      })
    ).toBe(false);
  });

  it("funds a priced balance worth $5", () => {
    expect(
      isFundedBalance({
        amount: new BigNumber("0.002"),
        priceUsd: new BigNumber(2500),
      })
    ).toBe(true);
  });

  it("does not fund a priced balance worth $0.001", () => {
    expect(
      isFundedBalance({
        amount: new BigNumber("0.001"),
        priceUsd: new BigNumber(1),
      })
    ).toBe(false);
  });

  it("funds a priced balance worth exactly $0.01", () => {
    expect(
      isFundedBalance({
        amount: new BigNumber("0.01"),
        priceUsd: new BigNumber(1),
      })
    ).toBe(true);
  });

  it("uses the unit threshold when no positive price is known", () => {
    expect(
      isFundedBalance({ amount: new BigNumber("0.0000005"), priceUsd: null })
    ).toBe(false);
    expect(
      isFundedBalance({ amount: new BigNumber("0.000001"), priceUsd: null })
    ).toBe(true);
    expect(
      isFundedBalance({
        amount: new BigNumber("0.0000005"),
        priceUsd: new BigNumber(0),
      })
    ).toBe(false);
    expect(
      isFundedBalance({ amount: new BigNumber("5"), priceUsd: null })
    ).toBe(true);
  });

  it("does not fund zero or negative balances", () => {
    expect(
      isFundedBalance({ amount: new BigNumber("0"), priceUsd: null })
    ).toBe(false);
    expect(
      isFundedBalance({ amount: new BigNumber(-1), priceUsd: new BigNumber(1) })
    ).toBe(false);
  });
});
