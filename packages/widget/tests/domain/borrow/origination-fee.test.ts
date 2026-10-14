import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import { Market } from "../../../src/domain/borrow/catalog/market";
import { resolveBorrowOrigination } from "../../../src/domain/borrow/execution/origination-fee";
import { exactDecimal } from "../../../src/domain/finance/exact";

const marketDto = {
  id: "morpho-blue-base-weth-usdc",
  integrationId: "morpho-blue-borrow",
  network: "base",
  type: "isolated",
  poolAddress: "0x0000000000000000000000000000000000000001",
  loanToken: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  collateralTokens: [
    {
      token: {
        address: "0x4200000000000000000000000000000000000006",
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
      },
      priceUsd: "2000",
      maxLtv: "0.8",
      liquidationThreshold: "0.85",
      liquidationPenalty: "0.05",
      supplyRate: "0",
    },
  ],
  borrowRate: "0.06",
  totalSupply: "1000000",
  totalSupplyRaw: "1000000000000",
  totalBorrow: "500000",
  totalBorrowRaw: "500000000000",
  availableLiquidity: "500000",
  availableLiquidityRaw: "500000000000",
  utilizationRate: "0.5",
  loanTokenPriceUsd: "1",
  isBorrowEnabled: true,
  supplyCollateralFeeBps: "0",
  feeWrapperAddress: null,
  originationFeeBps: "0",
  originationFeeWrapperAddress: null,
  blueBundleOriginationFeeBps: null,
  minLoan: null,
} as const;

const wrapper = "0x3C778911B9e36eA8CE53dBF211a203e3300939b6";

const decodeMarket = (fees: {
  readonly blueBundleOriginationFeeBps?: string | null;
  readonly originationFeeBps?: string;
  readonly originationFeeWrapperAddress?: string | null;
}) => Schema.decodeSync(Market)({ ...marketDto, ...fees });

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
