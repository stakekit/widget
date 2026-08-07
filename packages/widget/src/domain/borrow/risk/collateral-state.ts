import BigNumber from "bignumber.js";
import type { Market } from "../catalog/market";
import { decodeTokenId, type TokenId } from "../ids";
import type {
  IsolatedRiskSnapshot,
  SupplyBalance,
} from "../positions/borrow-account-snapshot";
import type {
  CollateralDefinition,
  CollateralExposure,
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
        liquidationThreshold: new BigNumber(
          collateralToken.liquidationThreshold
        ),
        maxLtv: new BigNumber(collateralToken.maxLtv),
        priceUsd: new BigNumber(collateralToken.priceUsd),
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
      supplyBalance.balance > 0 &&
      (definition.priceUsd.isLessThanOrEqualTo(0) ||
        supplyBalance.balanceUsd <= 0)
    ) {
      return { reason: "missingPrice", status: "unavailable" };
    }

    collateral.push({
      ...definition,
      collateralUsd: new BigNumber(supplyBalance.balanceUsd),
      enabled: supplyBalance.isCollateral,
    });
  }

  return { collateral, status: "available" };
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
        candidate.availableToBorrowUsd !== first.availableToBorrowUsd ||
        candidate.currentLtv !== first.currentLtv ||
        candidate.healthFactor !== first.healthFactor ||
        candidate.liquidationThreshold !== first.liquidationThreshold
    );

  return hasConflict
    ? { reason: "conflictingPositionState", status: "unavailable" }
    : { positionState: first, status: "available" };
};
