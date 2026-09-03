import { Schema } from "effect";
import * as BorrowApi from "../../../generated/api/borrow";
import {
  ExactBaseUnitAmount,
  ExactDecimal,
  NonNegativeExactDecimal,
} from "../../finance/scalars";
import { IntegrationId, MarketId } from "../ids";
import { BorrowNetwork } from "../network";
import { NonNegativeRiskValue, RiskRatio } from "../risk/risk-values";
import { CollateralToken } from "./collateral-token";
import { BorrowToken } from "./token";

export const Market = Schema.Struct({
  ...BorrowApi.MarketDto.fields,
  availableLiquidity: ExactDecimal,
  availableLiquidityRaw: ExactBaseUnitAmount,
  borrowRate: ExactDecimal,
  collateralTokens: Schema.Array(CollateralToken),
  id: MarketId,
  integrationId: IntegrationId,
  loanToken: BorrowToken,
  loanTokenPriceUsd: NonNegativeExactDecimal,
  minLoan: Schema.NullOr(NonNegativeRiskValue),
  network: BorrowNetwork,
  // ast-grep-ignore: no-financial-finite-from-string -- integer basis-point count, not a token amount
  supplyCollateralFeeBps: Schema.FiniteFromString.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(500)
  ),
  totalBorrow: ExactDecimal,
  totalBorrowRaw: ExactBaseUnitAmount,
  totalSupply: ExactDecimal,
  totalSupplyRaw: ExactBaseUnitAmount,
  utilizationRate: RiskRatio,
});
export type Market = typeof Market.Type;

export const getBorrowMarketPairLabel = (market: Market) => {
  const collateralToken = market.collateralTokens[0];

  return collateralToken
    ? `${collateralToken.token.symbol} / ${market.loanToken.symbol}`
    : market.loanToken.symbol;
};
