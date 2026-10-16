import type BigNumber from "bignumber.js";
import { exactZero, sumExact } from "../../finance/exact";
import type { Market } from "../catalog/market";
import { decodeTokenId, type MarketId, type TokenId } from "../ids";
import type {
  BorrowAccountSnapshot,
  DebtBalance,
  IsolatedRiskSnapshot,
  SupplyBalance,
} from "../positions/borrow-account-snapshot";
import type {
  CollateralDefinition,
  CollateralExposure,
  OracleRiskAnchor,
  RiskUnavailableReason,
} from "./risk-model";

export const getDefinitions = (
  markets: ReadonlyArray<Market>
):
  | {
      readonly definitions: ReadonlyMap<TokenId, CollateralDefinition>;
      readonly status: "available";
    }
  | {
      readonly reason: RiskUnavailableReason;
      readonly status: "unavailable";
    } => {
  const definitions = new Map<TokenId, CollateralDefinition>();

  for (const market of markets) {
    for (const collateralToken of market.collateralTokens) {
      const tokenId = decodeTokenId({
        address: collateralToken.token.address,
        symbol: collateralToken.token.symbol,
      });
      const previous = definitions.get(tokenId);
      const definition = {
        liquidationThreshold: collateralToken.liquidationThreshold,
        maxLtv: collateralToken.maxLtv,
        priceUsd: collateralToken.priceUsd,
        tokenId,
      };

      if (
        previous &&
        (!previous.liquidationThreshold.isEqualTo(
          definition.liquidationThreshold
        ) ||
          !previous.maxLtv.isEqualTo(definition.maxLtv) ||
          !previous.priceUsd.isEqualTo(definition.priceUsd))
      ) {
        return { reason: "conflictingParameters", status: "unavailable" };
      }

      definitions.set(tokenId, definition);
    }
  }

  return { definitions, status: "available" };
};

export const getCollateralState = ({
  definitions,
  supplyBalances,
}: {
  readonly definitions: ReadonlyMap<TokenId, CollateralDefinition>;
  readonly supplyBalances: ReadonlyArray<SupplyBalance>;
}):
  | {
      readonly collateral: ReadonlyArray<CollateralExposure>;
      readonly status: "available";
    }
  | {
      readonly reason: RiskUnavailableReason;
      readonly status: "unavailable";
    } => {
  const collateral: CollateralExposure[] = [];

  for (const supplyBalance of supplyBalances) {
    const tokenId = decodeTokenId({
      address: supplyBalance.tokenAddress,
      symbol: supplyBalance.tokenSymbol,
    });
    const definition = definitions.get(tokenId);

    if (!definition) {
      if (supplyBalance.isCollateral) {
        return { reason: "missingParameters", status: "unavailable" };
      }
      continue;
    }

    if (
      supplyBalance.balance.isGreaterThan(0) &&
      definition.priceUsd.isLessThanOrEqualTo(0)
    ) {
      return { reason: "missingPrice", status: "unavailable" };
    }

    // The API rounds balanceUsd to cents, so dust reads "0.00"; value it at
    // the catalog price instead of treating it as unpriced.
    const collateralUsd = supplyBalance.balanceUsd.isGreaterThan(0)
      ? supplyBalance.balanceUsd
      : supplyBalance.balance.multipliedBy(definition.priceUsd);

    collateral.push({
      ...definition,
      collateralUsd,
      enabled: supplyBalance.isCollateral,
    });
  }

  return { collateral, status: "available" };
};

/**
 * Debt valued in USD. Like collateral, dust debt reads "0.00" from the API
 * (interest left after a partial repayment); value it at the loan-token price
 * so the protocol's remaining debt still bounds withdrawals.
 */
export const getDebtUsd = ({
  debtBalance,
  loanTokenPriceUsd,
}: {
  readonly debtBalance: DebtBalance;
  readonly loanTokenPriceUsd: BigNumber;
}): BigNumber =>
  debtBalance.balanceUsd.isGreaterThan(0)
    ? debtBalance.balanceUsd
    : debtBalance.balance.multipliedBy(loanTokenPriceUsd);

/**
 * The account total covers the debt the API could price to the cent; dust it
 * rounded to "0.00" is added at the loan-token price. Sub-cent dust the total
 * already absorbed may count twice, which only errs toward more debt.
 */
export const getAccountDebtUsd = ({
  loanPrices,
  snapshot,
}: {
  readonly loanPrices: ReadonlyMap<MarketId, BigNumber>;
  readonly snapshot: BorrowAccountSnapshot | null;
}): BigNumber => {
  if (!snapshot) return exactZero();

  const dustUsd = sumExact(
    snapshot.debtBalances
      .filter((debtBalance) => !debtBalance.balanceUsd.isGreaterThan(0))
      .map((debtBalance) =>
        getDebtUsd({
          debtBalance,
          loanTokenPriceUsd:
            loanPrices.get(debtBalance.marketId) ?? exactZero(),
        })
      )
  );

  return snapshot.totalBorrowedUsd.plus(dustUsd);
};

export const getIsolatedPositionState = (
  supplyBalances: ReadonlyArray<SupplyBalance>
):
  | {
      readonly positionState: IsolatedRiskSnapshot | null;
      readonly status: "available";
    }
  | {
      readonly reason: "conflictingPositionState";
      readonly status: "unavailable";
    } => {
  const positionStates = supplyBalances.flatMap((balance) =>
    balance.positionState ? [balance.positionState] : []
  );
  const first = positionStates[0] ?? null;
  const hasConflict =
    first !== null &&
    positionStates.some(
      (candidate) =>
        !candidate.availableToBorrowUsd.isEqualTo(first.availableToBorrowUsd) ||
        !candidate.currentLtv.isEqualTo(first.currentLtv) ||
        (candidate.healthFactor == null) !== (first.healthFactor == null) ||
        (candidate.healthFactor != null &&
          first.healthFactor != null &&
          !candidate.healthFactor.isEqualTo(first.healthFactor)) ||
        !candidate.liquidationThreshold.isEqualTo(first.liquidationThreshold)
    );

  return hasConflict
    ? { reason: "conflictingPositionState", status: "unavailable" }
    : { positionState: first, status: "available" };
};

/**
 * Recovers the oracle valuation behind an isolated-market snapshot. The
 * protocol computes LTV = D / C and headroom = C * LLTV - D with C in
 * loan-token units, so C is D / LTV when debt exists, otherwise
 * (D + headroom / loan price) / LLTV. Null when neither is derivable.
 */
export const deriveOracleRiskAnchor = ({
  debtBalance,
  market,
  positionState,
  supplyBalances,
}: {
  readonly debtBalance: DebtBalance | null;
  readonly market: Market;
  readonly positionState: IsolatedRiskSnapshot;
  readonly supplyBalances: ReadonlyArray<SupplyBalance>;
}): OracleRiskAnchor | null => {
  const collateralBalances = supplyBalances.filter(
    (balance) => balance.isCollateral && balance.balance.isGreaterThan(0)
  );
  const collateralTokenIds = new Set(
    collateralBalances.map((balance) =>
      decodeTokenId({
        address: balance.tokenAddress,
        symbol: balance.tokenSymbol,
      })
    )
  );
  const [collateralTokenId] = collateralTokenIds;
  if (collateralTokenIds.size !== 1 || collateralTokenId === undefined) {
    return null;
  }

  const collateralAmount = sumExact(
    collateralBalances.map((balance) => balance.balance)
  );
  const debtAmount = debtBalance?.balance ?? exactZero();
  const { availableToBorrowUsd, currentLtv, liquidationThreshold } =
    positionState;
  const collateralValue = ((): BigNumber | null => {
    if (debtAmount.isGreaterThan(0) && currentLtv.isGreaterThan(0)) {
      return debtAmount.dividedBy(currentLtv);
    }
    if (
      availableToBorrowUsd.isGreaterThan(0) &&
      market.loanTokenPriceUsd.isGreaterThan(0) &&
      liquidationThreshold.isGreaterThan(0)
    ) {
      return debtAmount
        .plus(availableToBorrowUsd.dividedBy(market.loanTokenPriceUsd))
        .dividedBy(liquidationThreshold);
    }

    return null;
  })();
  if (collateralValue === null) {
    return null;
  }

  return {
    collateralAmount,
    collateralTokenId,
    debtAmount,
    liquidationThreshold,
    loanPriceUsd: market.loanTokenPriceUsd,
    marketId: market.id,
    oraclePrice: collateralValue.dividedBy(collateralAmount),
  };
};
