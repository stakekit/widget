import {
  Array as EffectArray,
  Option,
  pipe,
  Record,
  Result,
  Schema,
} from "effect";
import { sumAll } from "effect/Number";
import * as BorrowApi from "../../generated/api/borrow";
import { decodeTokenId, MarketId, TokenAddress } from "./ids";
import { Integration } from "./integration";
import { Market } from "./market";
import { PendingActionsFromDto } from "./pending-action";
import { BigIntFromString, NumberFromString } from "./scalars";

export const SupplyBalance = Schema.Struct({
  ...BorrowApi.SupplyBalanceDto.fields,
  marketId: MarketId,
  tokenAddress: TokenAddress,
  balance: NumberFromString,
  balanceRaw: BigIntFromString,
  balanceUsd: NumberFromString,
  apy: NumberFromString,
  pendingActions: PendingActionsFromDto,
});
export type SupplyBalance = typeof SupplyBalance.Type;

export const DebtBalance = Schema.Struct({
  ...BorrowApi.DebtBalanceDto.fields,
  marketId: MarketId,
  tokenAddress: TokenAddress,
  balance: NumberFromString,
  balanceRaw: BigIntFromString,
  balanceUsd: NumberFromString,
  apy: NumberFromString,
  pendingActions: PendingActionsFromDto,
});
export type DebtBalance = typeof DebtBalance.Type;

export class Position extends Schema.Class<Position>("BorrowPosition")({
  id: MarketId,
  market: Market,
  integration: Integration,
  debtBalance: Schema.NullOr(DebtBalance),
  supplyBalances: Schema.Array(SupplyBalance),
  debtPendingActions: PendingActionsFromDto,
  supplyPendingActions: PendingActionsFromDto,
}) {
  getCurrentLtv() {
    if (this.debtBalance == null) {
      return null;
    }

    const totalCollateralUsd = this.getTotalCollateralUsd();

    if (totalCollateralUsd <= 0) {
      return null;
    }

    return this.debtBalance.balanceUsd / totalCollateralUsd;
  }

  getTotalCollateralUsd() {
    return pipe(
      EffectArray.filterMap(this.supplyBalances, (supplyBalance) =>
        supplyBalance.isCollateral
          ? Result.succeed(supplyBalance.balanceUsd)
          : Result.failVoid
      ),
      sumAll
    );
  }

  getCollateralTokenDetails() {
    const collateralTokensRecord = Record.fromIterableWith(
      this.market.collateralTokens,
      (collateralToken) => [
        decodeTokenId({
          symbol: collateralToken.token.symbol,
          address: collateralToken.token.address,
        }),
        collateralToken,
      ]
    );

    return EffectArray.reduce(
      this.supplyBalances,
      {
        maxLtv: Number.POSITIVE_INFINITY,
        liquidationThreshold: Number.POSITIVE_INFINITY,
        liquidationPenalty: Number.POSITIVE_INFINITY,
      },
      (details, supplyBalance) => {
        const tokenId = decodeTokenId({
          symbol: supplyBalance.tokenSymbol,
          address: supplyBalance.tokenAddress,
        });
        const collateralToken = Record.get(collateralTokensRecord, tokenId);

        if (Option.isNone(collateralToken)) {
          return details;
        }

        return {
          maxLtv: Math.min(details.maxLtv, collateralToken.value.maxLtv),
          liquidationThreshold: Math.min(
            details.liquidationThreshold,
            collateralToken.value.liquidationThreshold
          ),
          liquidationPenalty: Math.min(
            details.liquidationPenalty,
            collateralToken.value.liquidationPenalty
          ),
        };
      }
    );
  }

  getMeta() {
    const collateralTokens = this.supplyBalances.filter(
      (supplyBalance) => supplyBalance.isCollateral
    );
    const collateralToken = collateralTokens[0];

    if (!this.debtBalance || collateralTokens.length > 1 || !collateralToken) {
      return {
        name: this.market.loanToken.symbol,
        symbol: this.market.loanToken.symbol,
      };
    }

    return {
      name: `${collateralToken.tokenSymbol}/${this.debtBalance.tokenSymbol}`,
      symbol: collateralToken.tokenSymbol,
    };
  }

  getTotalSuppliedUsd() {
    return pipe(
      this.supplyBalances.map((supplyBalance) => supplyBalance.balanceUsd),
      sumAll
    );
  }

  getTotalBorrowedUsd() {
    return this.debtBalance?.balanceUsd ?? 0;
  }

  getNetWorthUsd() {
    return this.getTotalSuppliedUsd() - this.getTotalBorrowedUsd();
  }

  getHealthFactor() {
    if (this.debtBalance == null) {
      return null;
    }

    const currentLtv = this.getCurrentLtv();

    if (currentLtv == null || currentLtv <= 0) {
      return 0;
    }

    const { liquidationThreshold } = this.getCollateralTokenDetails();

    if (!Number.isFinite(liquidationThreshold)) {
      return 0;
    }

    return liquidationThreshold / currentLtv;
  }

  getNetApy() {
    const netWorthUsd = this.getNetWorthUsd();

    if (netWorthUsd === 0) {
      return 0;
    }

    const totalSupplyEarnings = pipe(
      this.supplyBalances.map(
        (supplyBalance) => supplyBalance.balanceUsd * supplyBalance.apy
      ),
      sumAll
    );

    const totalBorrowCosts =
      (this.debtBalance?.balanceUsd ?? 0) * (this.debtBalance?.apy ?? 0);

    return (totalSupplyEarnings - totalBorrowCosts) / netWorthUsd;
  }
}
