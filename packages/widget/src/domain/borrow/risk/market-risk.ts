import type { Market } from "../catalog/market";

type MarketRiskLimits = {
  readonly liquidationPenalty: number | null;
  readonly liquidationThreshold: number | null;
  readonly maxLtv: number | null;
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
    liquidationPenalty: Math.max(
      ...market.collateralTokens.map((token) => token.liquidationPenalty)
    ),
    liquidationThreshold: Math.min(
      ...market.collateralTokens.map((token) => token.liquidationThreshold)
    ),
    maxLtv: Math.min(...market.collateralTokens.map((token) => token.maxLtv)),
  };
};
