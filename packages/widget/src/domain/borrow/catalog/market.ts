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

// ast-grep-ignore: no-financial-finite-from-string -- integer basis-point count, not a token amount
const OriginationFeeBps = Schema.FiniteFromString.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThan(10_000)
);

export const Market = Schema.Struct({
  ...BorrowApi.MarketDto.fields,
  availableLiquidity: ExactDecimal,
  availableLiquidityRaw: ExactBaseUnitAmount,
  blueBundleOriginationFeeBps: Schema.NullOr(OriginationFeeBps),
  borrowRate: ExactDecimal,
  collateralTokens: Schema.Array(CollateralToken),
  id: MarketId,
  integrationId: IntegrationId,
  loanToken: BorrowToken,
  loanTokenPriceUsd: NonNegativeExactDecimal,
  minLoan: Schema.NullOr(NonNegativeRiskValue),
  network: BorrowNetwork,
  originationFeeBps: OriginationFeeBps,
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

// Below this, a meaningful borrow would exhaust the market and its rate is noise.
const MIN_LISTED_LIQUIDITY_USD = 10_000;
// Rates above 100% come from markets pinned at full utilization.
const MAX_LISTED_BORROW_RATE = 1;

export const getMarketAvailableLiquidityUsd = (market: Market) =>
  market.availableLiquidity.multipliedBy(market.loanTokenPriceUsd);

/** Markets offered for new borrows. Unpriced loan tokens count as no liquidity. */
export const isListedBorrowMarket = (market: Market) =>
  market.isBorrowEnabled &&
  getMarketAvailableLiquidityUsd(market).gte(MIN_LISTED_LIQUIDITY_USD) &&
  market.borrowRate.lte(MAX_LISTED_BORROW_RATE);

// Only isolated markets have a single collateral; pool markets list every
// eligible collateral, so naming one of them would invent a pair.
export const getBorrowMarketPairLabel = (market: Market) => {
  const collateralToken =
    market.type === "isolated" ? market.collateralTokens[0] : undefined;

  return collateralToken
    ? `${collateralToken.token.symbol} / ${market.loanToken.symbol}`
    : market.loanToken.symbol;
};
