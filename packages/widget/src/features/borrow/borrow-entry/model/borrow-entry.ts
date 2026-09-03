import type BigNumber from "bignumber.js";
import { Data, Option } from "effect";
import type { AsyncResult as AtomAsyncResult } from "effect/unstable/reactivity/AsyncResult";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { CollateralToken } from "../../../../domain/borrow/catalog/collateral-token";
import type { Integration } from "../../../../domain/borrow/catalog/integration";
import type { Market } from "../../../../domain/borrow/catalog/market";
import { decodeTokenId, type TokenId } from "../../../../domain/borrow/ids";
import type { BorrowNetwork } from "../../../../domain/borrow/network";
import {
  type BorrowPositions,
  emptyBorrowPositions,
} from "../../../../domain/borrow/positions/borrow-positions";
import type { MarketPosition } from "../../../../domain/borrow/positions/market-position";
import { exactDecimal, exactZero } from "../../../../domain/finance/exact";
import type { TokenBalance } from "../../../../domain/finance/models";
import type { WalletScopeKey } from "../../../../domain/wallet/wallet-scope";
import {
  type BorrowActionPreparation,
  type BorrowConstraintWarning,
  type BorrowMarketWalletBalances,
  deriveBorrowMarketWalletBalances,
  type OpenPositionProjection,
  prepareBorrowAction,
} from "../../action-preparation/index";
import type { BorrowAtomResultError } from "./errors";

export type BorrowFormIntent = {
  readonly borrowAmount: string;
  readonly collateralAmount: string;
  readonly selectedCollateralTokenId: TokenId | null;
  readonly selectedMarketId: string | null;
};

export type BorrowFormAction =
  | {
      readonly type: "borrowAmount/set";
      readonly amount: BigNumber | number | string;
    }
  | {
      readonly type: "collateralAmount/set";
      readonly amount: BigNumber | number | string;
    }
  | {
      readonly type: "collateralToken/select";
      readonly tokenId: TokenId;
    }
  | {
      readonly type: "market/select";
      readonly marketId: string;
    }
  | {
      readonly type: "reset";
    };

type BorrowFormValidation = {
  readonly borrowAmountGreaterThanAvailable: boolean;
  readonly collateralAmountGreaterThanBalance: boolean;
  readonly hasAmounts: boolean;
  readonly ltvGreaterThanMax: boolean;
  readonly projectedDebtBelowMinimum: boolean;
};

export type BorrowFormProjection = {
  readonly borrowMaxAmount: BigNumber;
  readonly borrowUsd: BigNumber;
  readonly collateralMaxAmount: BigNumber;
  readonly collateralUsd: BigNumber;
  readonly existingCollateralUsd: BigNumber;
  readonly existingDebtUsd: BigNumber;
  readonly maxLtv: BigNumber | null;
  readonly projectedCollateralUsd: BigNumber;
  readonly projectedDebtUsd: BigNumber;
  readonly projectedHealthFactor: BigNumber | null;
  readonly projectedLtv: BigNumber;
  readonly riskStatus: "available" | "unavailable";
};

export type BorrowEntryView = {
  readonly borrowAmount: BigNumber;
  readonly canSelectCollateralMaxAmount: boolean;
  readonly catalogResetNotice: boolean;
  readonly collateralAmount: BigNumber;
  readonly integrationsResult: AtomAsyncResult<
    ReadonlyArray<Integration>,
    BorrowAtomResultError
  >;
  readonly isActionReady: boolean;
  readonly markets: ReadonlyArray<Market>;
  readonly marketsResult: AtomAsyncResult<
    ReadonlyArray<Market>,
    BorrowAtomResultError
  >;
  readonly preparation: BorrowActionPreparation<OpenPositionProjection> | null;
  readonly projection: BorrowFormProjection;
  readonly selectedCollateralBalance:
    | BorrowMarketWalletBalances["selectedCollateralToken"]
    | null;
  readonly selectedCollateralToken: CollateralToken | null;
  readonly selectedCollateralTokenId: TokenId | null;
  readonly selectedIntegration: Integration | null;
  readonly selectedMarket: Market | null;
  readonly selectedMarketPosition: MarketPosition | null;
  readonly selectedMarketId: string | null;
  readonly validation: BorrowFormValidation;
  readonly walletBalances: BorrowMarketWalletBalances | null;
};

export class BorrowEntryKey extends Data.Class<{
  readonly network: BorrowNetwork;
  readonly scope: WalletScopeKey;
}> {}

export const makeDefaultBorrowFormIntent = (): BorrowFormIntent => ({
  borrowAmount: "0",
  collateralAmount: "0",
  selectedCollateralTokenId: null,
  selectedMarketId: null,
});

export const pinBorrowFormDefaults = ({
  intent,
  markets,
}: {
  readonly intent: BorrowFormIntent;
  readonly markets: ReadonlyArray<Market>;
}): BorrowFormIntent => {
  const selectedMarket =
    markets.find((market) => market.id === intent.selectedMarketId) ??
    markets.find((market) => market.isBorrowEnabled) ??
    null;
  const selectedCollateralToken =
    selectedMarket?.collateralTokens.find(
      (token) => decodeTokenId(token.token) === intent.selectedCollateralTokenId
    ) ??
    selectedMarket?.collateralTokens[0] ??
    null;

  return {
    ...intent,
    selectedCollateralTokenId:
      intent.selectedCollateralTokenId ??
      (selectedCollateralToken
        ? decodeTokenId(selectedCollateralToken.token)
        : null),
    selectedMarketId: intent.selectedMarketId ?? selectedMarket?.id ?? null,
  };
};

const toAmountString = (amount: BigNumber | number | string) =>
  exactDecimal(amount).toString(10);

export const applyBorrowFormAction = ({
  action,
  intent,
}: {
  readonly action: BorrowFormAction;
  readonly intent: BorrowFormIntent;
}): BorrowFormIntent => {
  switch (action.type) {
    case "borrowAmount/set":
      return {
        ...intent,
        borrowAmount: toAmountString(action.amount),
      };
    case "collateralAmount/set":
      return {
        ...intent,
        collateralAmount: toAmountString(action.amount),
      };
    case "collateralToken/select":
      return {
        ...intent,
        collateralAmount: "0",
        selectedCollateralTokenId: action.tokenId,
      };
    case "market/select":
      return {
        ...intent,
        borrowAmount: "0",
        collateralAmount: "0",
        selectedCollateralTokenId: null,
        selectedMarketId: action.marketId,
      };
    case "reset":
      return makeDefaultBorrowFormIntent();
  }
};

const getSelectedMarket = ({
  intent,
  markets,
}: {
  readonly intent: BorrowFormIntent;
  readonly markets: ReadonlyArray<Market>;
}) => {
  if (intent.selectedMarketId === null) {
    return markets[0] ?? null;
  }

  return (
    markets.find((market) => market.id === intent.selectedMarketId) ?? null
  );
};

const getSelectedCollateralToken = ({
  intent,
  selectedMarket,
}: {
  readonly intent: BorrowFormIntent;
  readonly selectedMarket: Market | null;
}) => {
  if (!selectedMarket) {
    return null;
  }

  if (intent.selectedCollateralTokenId === null) {
    return selectedMarket.collateralTokens[0] ?? null;
  }

  return (
    selectedMarket.collateralTokens.find(
      (collateralToken) =>
        decodeTokenId(collateralToken.token) ===
        intent.selectedCollateralTokenId
    ) ?? null
  );
};

export const shouldResetBorrowFormForCatalog = ({
  intent,
  markets,
}: {
  readonly intent: BorrowFormIntent;
  readonly markets: ReadonlyArray<Market>;
}) => {
  if (intent.selectedMarketId === null) {
    return false;
  }

  const selectedMarket = markets.find(
    (market) => market.id === intent.selectedMarketId
  );

  if (!selectedMarket?.isBorrowEnabled) {
    return true;
  }

  if (intent.selectedCollateralTokenId === null) {
    return false;
  }

  return !selectedMarket.collateralTokens.some(
    (collateralToken) =>
      decodeTokenId(collateralToken.token) === intent.selectedCollateralTokenId
  );
};

export const resolveBorrowEntryView = ({
  integrationsResult,
  intent,
  key,
  marketsResult,
  positionsResult = AsyncResult.success(emptyBorrowPositions),
  tokenBalances,
  tokenBalancesAvailable = true,
}: {
  readonly integrationsResult: AtomAsyncResult<
    ReadonlyArray<Integration>,
    BorrowAtomResultError
  >;
  readonly intent: BorrowFormIntent;
  readonly key: BorrowEntryKey;
  readonly marketsResult: AtomAsyncResult<
    ReadonlyArray<Market>,
    BorrowAtomResultError
  >;
  readonly positionsResult?: AtomAsyncResult<
    BorrowPositions,
    BorrowAtomResultError
  >;
  readonly tokenBalances: ReadonlyArray<TokenBalance>;
  readonly tokenBalancesAvailable?: boolean;
}): BorrowEntryView => {
  const markets = AsyncResult.getOrElse(marketsResult, () => []).filter(
    (market) => market.isBorrowEnabled
  );
  const integrations = AsyncResult.getOrElse(integrationsResult, () => []);
  const positions = positionsResult.pipe(AsyncResult.value, Option.getOrNull);
  const selectedMarket = getSelectedMarket({ intent, markets });
  const selectedMarketId = selectedMarket?.id ?? null;
  const selectedMarketPosition =
    selectedMarket && positions
      ? (positions.items.find(
          (position) => position.id === selectedMarket.id
        ) ?? null)
      : null;
  const selectedCollateralToken = getSelectedCollateralToken({
    intent,
    selectedMarket,
  });
  const selectedCollateralTokenId = selectedCollateralToken
    ? decodeTokenId(selectedCollateralToken.token)
    : null;
  const integrationsById = new Map(
    integrations.map((integration) => [integration.id, integration])
  );
  const selectedIntegration = selectedMarket
    ? (integrationsById.get(selectedMarket.integrationId) ?? null)
    : null;
  const walletBalances = selectedMarket
    ? deriveBorrowMarketWalletBalances({
        balances: tokenBalances,
        market: selectedMarket,
        selectedCollateralTokenId,
      })
    : null;
  const selectedCollateralBalance =
    walletBalances?.selectedCollateralToken ?? null;
  const borrowAmount = exactDecimal(intent.borrowAmount || 0);
  const collateralAmount = exactDecimal(intent.collateralAmount || 0);
  const hasRequiredFacts =
    (!borrowAmount.gt(0) || positions !== null) &&
    (!collateralAmount.gt(0) || tokenBalancesAvailable);
  const preparation =
    selectedMarket && selectedCollateralToken && hasRequiredFacts
      ? prepareBorrowAction({
          _tag: "OpenPositionDraft",
          address: key.scope.address,
          borrowAmount,
          collateralAmount,
          collateralToken: selectedCollateralToken,
          integrations,
          market: selectedMarket,
          positions: positions ?? emptyBorrowPositions,
          tokenBalances,
        })
      : null;
  const preparedProjection = preparation?.projection ?? null;
  const financials = preparedProjection?.financials ?? {
    existingCollateralUsd: exactZero(),
    existingDebtUsd: exactZero(),
    projectedCollateralUsd: exactZero(),
    projectedDebtUsd: exactZero(),
  };
  const risk = preparedProjection?.risk ?? {
    currentLtv: null,
    status: "unavailable" as const,
  };
  const availableRisk = risk.status === "available" ? risk : null;
  const hasAmounts = borrowAmount.gt(0) || collateralAmount.gt(0);
  const warnings: ReadonlyArray<BorrowConstraintWarning> =
    preparation?._tag === "Ready" ? preparation.warnings : [];
  const borrowAmountGreaterThanAvailable = warnings.includes(
    "AmountExceedsAvailableLiquidity"
  );
  const collateralAmountGreaterThanBalance = warnings.includes(
    "AmountExceedsWalletBalance"
  );
  const ltvGreaterThanMax = warnings.includes("RiskCapacityExceeded");
  const projectedDebtBelowMinimum = warnings.includes(
    "ProjectedDebtBelowMarketMinimum"
  );
  const isActionReady =
    preparation?._tag === "Ready" && !AsyncResult.isFailure(marketsResult);
  const projection: BorrowFormProjection = {
    borrowMaxAmount: preparedProjection?.borrowMaxAmount ?? exactZero(),
    borrowUsd: preparedProjection?.borrowUsd ?? exactZero(),
    collateralMaxAmount: preparedProjection?.collateralMaxAmount ?? exactZero(),
    collateralUsd: preparedProjection?.collateralUsd ?? exactZero(),
    existingCollateralUsd: financials.existingCollateralUsd,
    existingDebtUsd: financials.existingDebtUsd,
    maxLtv: availableRisk?.maxLtv ?? null,
    projectedCollateralUsd: financials.projectedCollateralUsd,
    projectedDebtUsd: financials.projectedDebtUsd,
    projectedHealthFactor: availableRisk?.projectedHealthFactor ?? null,
    projectedLtv: availableRisk?.projectedLtv ?? exactZero(),
    riskStatus: risk.status,
  };

  return {
    borrowAmount,
    canSelectCollateralMaxAmount:
      !!selectedMarket && projection.collateralMaxAmount.gt(0),
    catalogResetNotice: false,
    collateralAmount,
    integrationsResult,
    isActionReady,
    markets,
    marketsResult,
    preparation,
    projection,
    selectedCollateralBalance,
    selectedCollateralToken,
    selectedCollateralTokenId,
    selectedIntegration,
    selectedMarket,
    selectedMarketPosition,
    selectedMarketId,
    validation: {
      borrowAmountGreaterThanAvailable,
      collateralAmountGreaterThanBalance,
      hasAmounts,
      ltvGreaterThanMax,
      projectedDebtBelowMinimum,
    },
    walletBalances,
  };
};
