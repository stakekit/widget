import BigNumber from "bignumber.js";
import { describe, expect, it } from "vitest";

import { getBorrowMarketPairLabel } from "../../../src/domain/borrow/market";
import { deriveMarketRiskLimits } from "../../../src/domain/borrow/market-risk";
import {
  getBorrowNetworkForChainId,
  isBorrowNetwork,
} from "../../../src/domain/borrow/network";
import { makeBorrowMarket } from "../../fixtures/borrow";

describe("borrow domain", () => {
  it("decodes markets and derives risk values", () => {
    const market = makeBorrowMarket();
    const risk = deriveMarketRiskLimits(market);

    expect(market.loanToken.address).toBe(
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    );
    expect(risk).toEqual({
      liquidationPenalty: new BigNumber("0.05"),
      liquidationThreshold: new BigNumber("0.85"),
      maxLtv: new BigNumber("0.8"),
    });
    expect(market.supplyCollateralFeeBps).toBe(0);
    expect(() => makeBorrowMarket({ supplyCollateralFeeBps: "501" })).toThrow();
    expect(() => makeBorrowMarket({ supplyCollateralFeeBps: "0.5" })).toThrow();
    expect(() => makeBorrowMarket({ minLoan: "-1" })).toThrow();
    expect(() => makeBorrowMarket({ minLoan: "Infinity" })).toThrow();
  });

  it("names a collateral pair only for isolated markets", () => {
    expect(getBorrowMarketPairLabel(makeBorrowMarket())).toBe("USDC");
    expect(
      getBorrowMarketPairLabel(makeBorrowMarket({ type: "isolated" }))
    ).toBe("WETH / USDC");
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
