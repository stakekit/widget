import type BigNumber from "bignumber.js";
import { Data, Option } from "effect";
import type { AsyncResult as AtomAsyncResult } from "effect/reactivity/AsyncResult";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type { CollateralToken } from "../../../../domain/borrow/catalog/collateral-token";
import type { Integration } from "../../../../domain/borrow/catalog/integration";
import {
  getListedCollateralTokens,
  isListedBorrowMarket,
  type Market,
} from "../../../../domain/borrow/catalog/market";
import {
  decodeTokenId,
  type MarketId,
  type TokenId,
} from "../../../../domain/borrow/ids";
import type { BorrowNetwork } from "../../../../domain/borrow/network";
import {
  type BorrowPositions,
  emptyBorrowPositions,
} from "../../../../domain/borrow/positions/borrow-positions";
import type { MarketPosition } from "../../../../domain/borrow/positions/market-position";
import type { RiskGateBlockReason } from "../../../../domain/borrow/risk/risk-gate";
import { exactDecimal, exactZero } from "../../../../domain/finance/exact";
import type { TokenBalance } from "../../../../domain/finance/models";
import type { WalletScopeKey } from "../../../../domain/wallet/wallet-scope";
import {
  type Presentable,
  toPresentable,
} from "../../../../shared/effect/async-result";
import {
  type BorrowActionPreparation,
  type BorrowConstraintWarning,
  type BorrowMarketWalletBalances,
  deriveBorrowMarketWalletBalances,
  getBorrowActionRiskBlock,
  type OpenPositionProjection,
  prepareBorrowAction,
} from "../../action-preparation/index";
import type { BorrowAtomResultError } from "./errors";
import {
  type BorrowCollateralOption,
  rankBorrowCollateralOptions,
} from "./market-groups";

export type BorrowFormIntent = {
  readonly borrowAmount: string;
  readonly collateralAmount: string;
  readonly selectedCollateralTokenId: TokenId | null;
  readonly selectedMarketId: MarketId | null;
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
      readonly marketId: MarketId;
    }
  | {
      readonly type: "amounts/clear";
    };

type BorrowFormValidation = {
  readonly borrowAmountGreaterThanAvailable: boolean;
  readonly collateralAmountGreaterThanBalance: boolean;
  readonly hasAmounts: boolean;
  readonly projectedDebtBelowMinimum: boolean;
  /** The limit the Risk Gate blocks on. */
  readonly riskBlock: RiskGateBlockReason | null;
  /** A risk overshoot the user can still submit; never set with a block. */
  readonly riskWarning: boolean;
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
  /** Listed collateral for the selected market, default first. */
  readonly collateralOptions: ReadonlyArray<BorrowCollateralOption>;
  readonly collateralAmount: BigNumber;
  readonly integrations: ReadonlyArray<Integration>;
  readonly integrationsView: Presentable<
    ReadonlyArray<Integration>,
    BorrowAtomResultError
  >;
  readonly isActionReady: boolean;
  /** Listed markets of the catalog, empty until it has a value. */
  readonly markets: ReadonlyArray<Market>;
  readonly marketsView: Presentable<
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
  readonly selectedMarketId: MarketId | null;
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
  tokenBalances,
}: {
  readonly intent: BorrowFormIntent;
  readonly markets: ReadonlyArray<Market>;
  readonly tokenBalances: ReadonlyArray<TokenBalance> | null;
}): BorrowFormIntent => {
  const selectedMarket =
    markets.find((market) => market.id === intent.selectedMarketId) ??
    markets.find(isListedBorrowMarket) ??
    null;
  const defaultCollateralToken = selectedMarket
    ? (rankBorrowCollateralOptions({
        balances: tokenBalances,
        market: selectedMarket,
      })[0]?.collateralToken ?? null)
    : null;

  return {
    ...intent,
    selectedCollateralTokenId:
      intent.selectedCollateralTokenId ??
      (defaultCollateralToken
        ? decodeTokenId(defaultCollateralToken.token)
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
    case "amounts/clear":
      return { ...intent, borrowAmount: "0", collateralAmount: "0" };
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
  collateralOptions,
  intent,
}: {
  readonly collateralOptions: ReadonlyArray<BorrowCollateralOption>;
  readonly intent: BorrowFormIntent;
}) => {
  if (intent.selectedCollateralTokenId === null) {
    return collateralOptions[0]?.collateralToken ?? null;
  }

  return (
    collateralOptions.find(
      ({ collateralToken }) =>
        decodeTokenId(collateralToken.token) ===
        intent.selectedCollateralTokenId
    )?.collateralToken ?? null
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

  if (!selectedMarket || !isListedBorrowMarket(selectedMarket)) {
    return true;
  }

  if (intent.selectedCollateralTokenId === null) {
    return false;
  }

  return !getListedCollateralTokens(selectedMarket).some(
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
    isListedBorrowMarket
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
  const collateralOptions = selectedMarket
    ? rankBorrowCollateralOptions({
        balances: tokenBalancesAvailable ? tokenBalances : null,
        market: selectedMarket,
      })
    : [];
  const selectedCollateralToken = getSelectedCollateralToken({
    collateralOptions,
    intent,
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
  const riskBlock = getBorrowActionRiskBlock(preparation);
  const riskWarning = warnings.includes("RiskCapacityExceeded");
  const projectedDebtBelowMinimum = warnings.includes(
    "ProjectedDebtBelowMarketMinimum"
  );
  const isActionReady =
    preparation?._tag === "Ready" &&
    !AsyncResult.isFailure(marketsResult) &&
    riskBlock === null;
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
    collateralOptions,
    integrations,
    integrationsView: toPresentable(integrationsResult),
    isActionReady,
    markets,
    marketsView: toPresentable(marketsResult),
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
      projectedDebtBelowMinimum,
      riskBlock,
      riskWarning,
    },
    walletBalances,
  };
};
