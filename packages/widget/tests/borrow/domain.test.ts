import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import { Market } from "../../src/domain/borrow/market";
import { deriveMarketRiskLimits } from "../../src/domain/borrow/market-risk";
import {
  getBorrowNetworkForChainId,
  isBorrowNetwork,
} from "../../src/domain/borrow/network";

const marketDto = {
  id: "aave-v3-ethereum-usdc",
  integrationId: "aave-borrow",
  network: "ethereum",
  type: "pool",
  poolAddress: "0x0000000000000000000000000000000000000001",
  loanToken: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  collateralTokens: [
    {
      token: {
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
      },
      priceUsd: "2000",
      maxLtv: "0.8",
      liquidationThreshold: "0.85",
      liquidationPenalty: "0.05",
      supplyRate: "0.02",
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
  minLoan: null,
} as const;

describe("borrow domain", () => {
  it("decodes markets and derives risk values", () => {
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const risk = deriveMarketRiskLimits(market);

    expect(market.loanToken.address).toBe(
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    );
    expect(risk).toEqual({
      liquidationPenalty: 0.05,
      liquidationThreshold: 0.85,
      maxLtv: 0.8,
    });
    expect(() =>
      Schema.decodeUnknownSync(Market)({ ...marketDto, minLoan: "-1" })
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(Market)({ ...marketDto, minLoan: "Infinity" })
    ).toThrow();
  });

  it("supports initial borrow network scope", () => {
    expect(getBorrowNetworkForChainId(1)).toBe("ethereum");
    expect(getBorrowNetworkForChainId(8453)).toBe("base");
    expect(getBorrowNetworkForChainId(42161)).toBe("arbitrum");
    expect(getBorrowNetworkForChainId(10)).toBe("optimism");
    expect(getBorrowNetworkForChainId(137)).toBeNull();
    expect(isBorrowNetwork("polygon")).toBe(false);
  });
});
