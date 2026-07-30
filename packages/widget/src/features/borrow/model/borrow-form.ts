import BigNumber from "bignumber.js";
import { Data } from "effect";
import type { AsyncResult as AtomAsyncResult } from "effect/unstable/reactivity/AsyncResult";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  type BorrowPositions,
  emptyBorrowPositions,
} from "../../../domain/borrow/borrow-positions";
import type { CollateralToken } from "../../../domain/borrow/collateral-token";
import type { Integration } from "../../../domain/borrow/integration";
import type { Market } from "../../../domain/borrow/market";
import type { MarketPosition } from "../../../domain/borrow/market-position";
import type { BorrowNetwork } from "../../../domain/borrow/network";
import type { TokenBalance } from "../../../domain/schema/financial-models";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import {
  type BorrowActionBlockReason,
  type BorrowActionPreparation,
  type OpenPositionProjection,
  prepareBorrowAction,
} from "./action-preparation";
import type { BorrowAtomResultError } from "./borrow-errors";
import {
  type BorrowMarketWalletBalances,
  deriveBorrowMarketWalletBalances,
} from "./wallet-balances";

export type BorrowFormIntent = {
  readonly borrowAmount: string;
  readonly collateralAmount: string;
  readonly selectedCollateralTokenAddress: string | null;
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
      readonly tokenAddress: string | null;
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
  readonly hasValidationError: boolean;
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
  readonly maxLtv: number | null;
  readonly projectedCollateralUsd: BigNumber;
  readonly projectedDebtUsd: BigNumber;
  readonly projectedHealthFactor: number | null;
  readonly projectedLtv: number;
  readonly riskStatus: "available" | "unavailable";
};

export type BorrowDashboardView = {
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
  readonly selectedCollateralTokenAddress: string | null;
  readonly selectedIntegration: Integration | null;
  readonly selectedMarket: Market | null;
  readonly selectedMarketPosition: MarketPosition | null;
  readonly selectedMarketId: string | null;
  readonly validation: BorrowFormValidation;
  readonly walletBalances: BorrowMarketWalletBalances | null;
};

export class BorrowDashboardKey extends Data.Class<{
  readonly network: BorrowNetwork;
  readonly scope: WalletScopeKey;
}> {}

export const makeDefaultBorrowFormIntent = (): BorrowFormIntent => ({
  borrowAmount: "0",
  collateralAmount: "0",
  selectedCollateralTokenAddress: null,
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
      (token) => token.token.address === intent.selectedCollateralTokenAddress
    ) ??
    selectedMarket?.collateralTokens[0] ??
    null;

  return {
    ...intent,
    selectedCollateralTokenAddress:
      intent.selectedCollateralTokenAddress ??
      selectedCollateralToken?.token.address ??
      null,
    selectedMarketId: intent.selectedMarketId ?? selectedMarket?.id ?? null,
  };
};

const toAmountString = (amount: BigNumber | number | string) =>
  new BigNumber(amount).toString(10);

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
        selectedCollateralTokenAddress: action.tokenAddress,
      };
    case "market/select":
      return {
        ...intent,
        borrowAmount: "0",
        collateralAmount: "0",
        selectedCollateralTokenAddress: null,
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

  if (intent.selectedCollateralTokenAddress === null) {
    return selectedMarket.collateralTokens[0] ?? null;
  }

  return (
    selectedMarket.collateralTokens.find(
      (collateralToken) =>
        collateralToken.token.address === intent.selectedCollateralTokenAddress
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

  if (intent.selectedCollateralTokenAddress === null) {
    return false;
  }

  return !selectedMarket.collateralTokens.some(
    (collateralToken) =>
      collateralToken.token.address === intent.selectedCollateralTokenAddress
  );
};

export const resolveBorrowDashboardView = ({
  integrationsResult,
  intent,
  key,
  marketsResult,
  positionsResult = AsyncResult.success(emptyBorrowPositions),
  tokenBalances,
}: {
  readonly integrationsResult: AtomAsyncResult<
    ReadonlyArray<Integration>,
    BorrowAtomResultError
  >;
  readonly intent: BorrowFormIntent;
  readonly key: BorrowDashboardKey;
  readonly marketsResult: AtomAsyncResult<
    ReadonlyArray<Market>,
    BorrowAtomResultError
  >;
  readonly positionsResult?: AtomAsyncResult<
    BorrowPositions,
    BorrowAtomResultError
  >;
  readonly tokenBalances: ReadonlyArray<TokenBalance>;
}): BorrowDashboardView => {
  const markets = AsyncResult.getOrElse(marketsResult, () => []).filter(
    (market) => market.isBorrowEnabled
  );
  const integrations = AsyncResult.getOrElse(integrationsResult, () => []);
  const positions = AsyncResult.getOrElse(
    positionsResult,
    () => emptyBorrowPositions
  );
  const selectedMarket = getSelectedMarket({ intent, markets });
  const selectedMarketId = selectedMarket?.id ?? null;
  const selectedMarketPosition = selectedMarket
    ? (positions.items.find((position) => position.id === selectedMarket.id) ??
      null)
    : null;
  const selectedCollateralToken = getSelectedCollateralToken({
    intent,
    selectedMarket,
  });
  const selectedCollateralTokenAddress =
    selectedCollateralToken?.token.address ?? null;
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
        selectedCollateralTokenAddress,
      })
    : null;
  const selectedCollateralBalance =
    walletBalances?.selectedCollateralToken ?? null;
  const borrowAmount = new BigNumber(intent.borrowAmount || 0);
  const collateralAmount = new BigNumber(intent.collateralAmount || 0);
  const preparation =
    selectedMarket && selectedCollateralToken
      ? prepareBorrowAction({
          _tag: "OpenPositionDraft",
          address: key.scope.address,
          borrowAmount,
          collateralAmount,
          collateralToken: selectedCollateralToken,
          integrations,
          market: selectedMarket,
          positions,
          tokenBalances,
        })
      : null;
  const preparedProjection = preparation?.projection ?? null;
  const financials = preparedProjection?.financials ?? {
    existingCollateralUsd: new BigNumber(0),
    existingDebtUsd: new BigNumber(0),
    projectedCollateralUsd: new BigNumber(0),
    projectedDebtUsd: new BigNumber(0),
  };
  const risk = preparedProjection?.risk ?? {
    currentLtv: null,
    status: "unavailable" as const,
  };
  const availableRisk = risk.status === "available" ? risk : null;
  const hasAmounts = borrowAmount.gt(0) || collateralAmount.gt(0);
  const reasons: ReadonlyArray<BorrowActionBlockReason> =
    preparation?._tag === "Blocked" ? preparation.reasons : [];
  const borrowAmountGreaterThanAvailable = reasons.includes(
    "AmountExceedsAvailableLiquidity"
  );
  const collateralAmountGreaterThanBalance = reasons.includes(
    "AmountExceedsWalletBalance"
  );
  const ltvGreaterThanMax = reasons.includes("RiskCapacityExceeded");
  const projectedDebtBelowMinimum = reasons.includes(
    "ProjectedDebtBelowMarketMinimum"
  );
  const hasValidationError = reasons.length > 0;
  const isActionReady = preparation?._tag === "Ready";
  const projection: BorrowFormProjection = {
    borrowMaxAmount: preparedProjection?.borrowMaxAmount ?? new BigNumber(0),
    borrowUsd: preparedProjection?.borrowUsd ?? new BigNumber(0),
    collateralMaxAmount:
      preparedProjection?.collateralMaxAmount ?? new BigNumber(0),
    collateralUsd: preparedProjection?.collateralUsd ?? new BigNumber(0),
    existingCollateralUsd: financials.existingCollateralUsd,
    existingDebtUsd: financials.existingDebtUsd,
    maxLtv: availableRisk?.maxLtv ?? null,
    projectedCollateralUsd: financials.projectedCollateralUsd,
    projectedDebtUsd: financials.projectedDebtUsd,
    projectedHealthFactor: availableRisk?.projectedHealthFactor ?? null,
    projectedLtv: availableRisk?.projectedLtv ?? 0,
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
    selectedCollateralTokenAddress,
    selectedIntegration,
    selectedMarket,
    selectedMarketPosition,
    selectedMarketId,
    validation: {
      borrowAmountGreaterThanAvailable,
      collateralAmountGreaterThanBalance,
      hasAmounts,
      hasValidationError,
      ltvGreaterThanMax,
      projectedDebtBelowMinimum,
    },
    walletBalances,
  };
};
