import { describe, expect, it } from "vitest";
import { resolveBorrowOrigination } from "../../../src/domain/borrow/execution/origination-fee";
import { exactDecimal } from "../../../src/domain/finance/exact";
import {
  makeBorrowCollateralTokenDto,
  makeBorrowMarket,
} from "../../fixtures/borrow";

const wrapper = "0x3C778911B9e36eA8CE53dBF211a203e3300939b6";

const decodeMarket = (fees: {
  readonly blueBundleOriginationFeeBps?: string | null;
  readonly originationFeeBps?: string;
  readonly originationFeeWrapperAddress?: string | null;
}) =>
  makeBorrowMarket({
    collateralTokens: [
      makeBorrowCollateralTokenDto({
        supplyRate: "0",
        token: {
          address: "0x4200000000000000000000000000000000000006",
          decimals: 18,
          name: "Wrapped Ether",
          symbol: "WETH",
        },
      }),
    ],
    id: "morpho-blue-base-weth-usdc",
    integrationId: "morpho-blue-borrow",
    loanToken: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
      name: "USD Coin",
      symbol: "USDC",
    },
    network: "base",
    type: "isolated",
    ...fees,
  });

describe("borrow origination fee", () => {
  it("grosses up a BlueBundle borrow with the WAD-rate fee", () => {
    // N = 1_000_000 base units (1 USDC), f = 25 bps
    // T = floor(1_000_000 * 25 / 10_000) = 2_500
    // G = N + T = 1_002_500
    // R = floor(2_500 * 10^18 / 1_002_500) = 2_493_765_586_034_912
    // F = floor(1_002_500 * 2_493_765_586_034_912 / 10^18) = 2_499
    const result = resolveBorrowOrigination({
      market: decodeMarket({
        blueBundleOriginationFeeBps: "25",
        originationFeeBps: "25",
      }),
      netAmount: exactDecimal("1"),
    });

    expect(result).toEqual({
      feeAmount: exactDecimal("0.002499"),
      feeBps: 25,
      grossAmount: exactDecimal("1.0025"),
      route: "BlueBundle",
    });
  });

  it("routes through BlueBundle even when an allocator wrapper is configured", () => {
    const result = resolveBorrowOrigination({
      market: decodeMarket({
        blueBundleOriginationFeeBps: "0",
        originationFeeBps: "50",
        originationFeeWrapperAddress: wrapper,
      }),
      netAmount: exactDecimal("1"),
    });

    expect(result).toEqual({
      feeAmount: exactDecimal(0),
      feeBps: 0,
      grossAmount: exactDecimal("1"),
      route: "BlueBundle",
    });
  });

  it("grosses up an allocator borrow with a ceiling division", () => {
    // N = 1_000_000 base units (1 USDC), f = 50 bps
    // G = ceil(1_000_000 * 10_000 / 9_950) = ceil(1_005_025.125...) = 1_005_026
    // F = floor(1_005_026 * 50 / 10_000) = 5_025
    const result = resolveBorrowOrigination({
      market: decodeMarket({
        originationFeeBps: "50",
        originationFeeWrapperAddress: wrapper,
      }),
      netAmount: exactDecimal("1"),
    });

    expect(result).toEqual({
      feeAmount: exactDecimal("0.005025"),
      feeBps: 50,
      grossAmount: exactDecimal("1.005026"),
      route: "Allocator",
    });
  });

  it.each([
    { name: "no wrapper", fees: { originationFeeBps: "50" } },
    {
      name: "a zero-rate wrapper",
      fees: { originationFeeBps: "0", originationFeeWrapperAddress: wrapper },
    },
  ])("charges no origination fee with $name", ({ fees }) => {
    const result = resolveBorrowOrigination({
      market: decodeMarket(fees),
      netAmount: exactDecimal("1.5"),
    });

    expect(result).toEqual({
      feeAmount: exactDecimal(0),
      feeBps: 0,
      grossAmount: exactDecimal("1.5"),
      route: "None",
    });
  });

  it("rejects origination fee rates that are not integer basis points below 100%", () => {
    expect(() => decodeMarket({ originationFeeBps: "10000" })).toThrow();
    expect(() =>
      decodeMarket({ blueBundleOriginationFeeBps: "2.5" })
    ).toThrow();
    expect(() => decodeMarket({ originationFeeBps: "-1" })).toThrow();
  });
});
