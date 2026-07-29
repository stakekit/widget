import { Schema } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import { CollateralToken } from "./collateral-token";
import { IntegrationId, MarketId } from "./ids";
import { BorrowNetwork } from "./network";
import {
  NonNegativeFiniteFromString,
  RiskRatioFromString,
} from "./risk-values";
import { BorrowToken } from "./token";

export const Market = Schema.Struct({
  ...BorrowApi.MarketDto.fields,
  availableLiquidity: Schema.FiniteFromString,
  availableLiquidityRaw: Schema.BigIntFromString,
  borrowRate: Schema.FiniteFromString,
  collateralTokens: Schema.Array(CollateralToken),
  id: MarketId,
  integrationId: IntegrationId,
  loanToken: BorrowToken,
  loanTokenPriceUsd: Schema.FiniteFromString.check(
    Schema.isGreaterThanOrEqualTo(0)
  ),
  minLoan: Schema.NullOr(NonNegativeFiniteFromString),
  network: BorrowNetwork,
  totalBorrow: Schema.FiniteFromString,
  totalBorrowRaw: Schema.BigIntFromString,
  totalSupply: Schema.FiniteFromString,
  totalSupplyRaw: Schema.BigIntFromString,
  utilizationRate: RiskRatioFromString,
});
export type Market = typeof Market.Type;
