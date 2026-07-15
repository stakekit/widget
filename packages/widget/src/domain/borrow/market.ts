import { Schema } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import { CollateralToken } from "./collateral-token";
import { IntegrationId, MarketId } from "./ids";
import { BorrowNetwork } from "./network";
import { BorrowToken } from "./token";

export class Market extends Schema.Class<Market>("BorrowMarket")({
  ...BorrowApi.MarketDto.fields,
  id: MarketId,
  integrationId: IntegrationId,
  network: BorrowNetwork,
  loanToken: BorrowToken,
  collateralTokens: Schema.Array(CollateralToken),
  borrowRate: Schema.FiniteFromString,
  totalSupply: Schema.FiniteFromString,
  totalSupplyRaw: Schema.BigIntFromString,
  totalBorrow: Schema.FiniteFromString,
  totalBorrowRaw: Schema.BigIntFromString,
  availableLiquidity: Schema.FiniteFromString,
  availableLiquidityRaw: Schema.BigIntFromString,
  utilizationRate: Schema.FiniteFromString,
  loanTokenPriceUsd: Schema.FiniteFromString,
}) {
  getMaxLtv() {
    if (this.collateralTokens.length === 0) {
      return null;
    }

    return Math.min(...this.collateralTokens.map((token) => token.maxLtv));
  }

  getLiquidationPenalty() {
    if (this.collateralTokens.length === 0) {
      return null;
    }

    return Math.max(
      ...this.collateralTokens.map((token) => token.liquidationPenalty)
    );
  }

  getLiquidationThreshold() {
    if (this.collateralTokens.length === 0) {
      return null;
    }

    return Math.min(
      ...this.collateralTokens.map((token) => token.liquidationThreshold)
    );
  }
}
