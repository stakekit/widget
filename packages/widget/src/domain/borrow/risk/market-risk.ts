import BigNumber from "bignumber.js";
import type { Market } from "../catalog/market";

type MarketRiskLimits = {
  readonly liquidationPenalty: BigNumber | null;
  readonly liquidationThreshold: BigNumber | null;
  readonly maxLtv: BigNumber | null;
};

export const deriveMarketRiskLimits = (market: Market): MarketRiskLimits => {
  if (market.collateralTokens.length === 0) {
    return {
      liquidationPenalty: null,
      liquidationThreshold: null,
      maxLtv: null,
    };
  }

  return {
    liquidationPenalty: market.collateralTokens.reduce<BigNumber | null>(
      (result, token) =>
        result == null
          ? token.liquidationPenalty
          : BigNumber.max(result, token.liquidationPenalty),
      null
    ),
    liquidationThreshold: market.collateralTokens.reduce<BigNumber | null>(
      (result, token) =>
        result == null
          ? token.liquidationThreshold
          : BigNumber.min(result, token.liquidationThreshold),
      null
    ),
    maxLtv: market.collateralTokens.reduce<BigNumber | null>(
      (result, token) =>
        result == null ? token.maxLtv : BigNumber.min(result, token.maxLtv),
      null
    ),
  };
};
