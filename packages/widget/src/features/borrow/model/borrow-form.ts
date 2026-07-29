import BigNumber from "bignumber.js";
import { Data, Match } from "effect";
import type { AsyncResult as AtomAsyncResult } from "effect/unstable/reactivity/AsyncResult";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  buildBorrowActionRequest,
  decodeBorrowForm,
} from "../../../domain/borrow/action-request";
import {
  type BorrowPositions,
  emptyBorrowPositions,
} from "../../../domain/borrow/borrow-positions";
import type { CollateralToken } from "../../../domain/borrow/collateral-token";
import { decodeTokenId } from "../../../domain/borrow/ids";
import type { Integration } from "../../../domain/borrow/integration";
import type { Market } from "../../../domain/borrow/market";
import type { MarketPosition } from "../../../domain/borrow/market-position";
import { isDebtBelowMarketMinimum } from "../../../domain/borrow/minimum-debt";
import type { BorrowNetwork } from "../../../domain/borrow/network";
import type { RiskChange } from "../../../domain/borrow/risk-position";
import type { TokenBalance } from "../../../domain/schema/financial-models";
import type { WalletAddress } from "../../../domain/schema/identifiers";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import type { BorrowTransactionFlowReview } from "../../borrow-transaction-flow/state";
import type { BorrowAtomResultError } from "./borrow-errors";
import { makeBorrowRiskSummary } from "./borrow-risk-summary";
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
  readonly preparedReviewState: BorrowTransactionFlowReview | null;
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

const getPreparedReviewState = ({
  borrowAmount,
  collateralAmount,
  isActionReady,
  projection,
  selectedCollateralToken,
  selectedIntegration,
  selectedMarket,
  walletAddress,
}: {
  readonly borrowAmount: BigNumber;
  readonly collateralAmount: BigNumber;
  readonly isActionReady: boolean;
  readonly projection: BorrowFormProjection;
  readonly selectedCollateralToken: CollateralToken | null;
  readonly selectedIntegration: Integration | null;
  readonly selectedMarket: Market | null;
  readonly walletAddress: WalletAddress;
}): BorrowTransactionFlowReview | null => {
  if (!isActionReady || !selectedMarket || !selectedCollateralToken) {
    return null;
  }

  const form = decodeBorrowForm({
    borrowAmount,
    collateralAmount,
    selectedCollateralToken,
    selectedMarket,
  });

  if (!form) {
    return null;
  }

  const summaryAction = Match.value(form).pipe(
    Match.tag("BorrowPlusCollateral", () => "borrowAndSupply" as const),
    Match.tag("BorrowOnly", () => "borrow" as const),
    Match.tag("CollateralOnly", () => "supply" as const),
    Match.exhaustive
  );
  const riskSummary =
    projection.riskStatus === "available"
      ? makeBorrowRiskSummary({
          healthFactor: projection.projectedHealthFactor,
          ltv: projection.projectedLtv,
          status: projection.riskStatus,
        })
      : makeBorrowRiskSummary({ status: projection.riskStatus });

  return {
    request: buildBorrowActionRequest({
      address: walletAddress,
      form,
    }),
    summary: {
      action: summaryAction,
      ...(form._tag !== "CollateralOnly"
        ? {
            borrowAmount: form.borrowAmount.toString(10),
            loanTokenSymbol: selectedMarket.loanToken.symbol,
          }
        : {}),
      ...(form._tag !== "BorrowOnly"
        ? {
            collateralAmount: form.collateralAmount.toString(10),
            collateralTokenSymbol: form.selectedCollateralToken.token.symbol,
          }
        : {}),
      existingCollateralUsd: projection.existingCollateralUsd.toString(10),
      existingDebtUsd: projection.existingDebtUsd.toString(10),
      projectedCollateralUsd: projection.projectedCollateralUsd.toString(10),
      projectedDebtUsd: projection.projectedDebtUsd.toString(10),
      ...riskSummary,
      marketLabel: selectedCollateralToken
        ? `${selectedCollateralToken.token.symbol} / ${selectedMarket.loanToken.symbol}`
        : selectedMarket.loanToken.symbol,
      network: selectedMarket.network,
      providerName: selectedIntegration?.name ?? selectedMarket.integrationId,
    },
  };
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
  const selectedMarketRisk = selectedMarket
    ? positions.riskFor(selectedMarket)
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
  const borrowMaxAmount = new BigNumber(
    selectedMarket?.availableLiquidity ?? 0
  );
  const collateralMaxAmount =
    selectedCollateralBalance?.amountValue ?? new BigNumber(0);
  const borrowAmountGreaterThanAvailable =
    !!selectedMarket && borrowAmount.gt(borrowMaxAmount);
  const collateralAmountGreaterThanBalance =
    !!selectedMarket && collateralAmount.gt(collateralMaxAmount);
  const borrowUsd = selectedMarket
    ? borrowAmount.multipliedBy(selectedMarket.loanTokenPriceUsd)
    : new BigNumber(0);
  const collateralUsd =
    selectedCollateralToken == null
      ? new BigNumber(0)
      : collateralAmount.multipliedBy(selectedCollateralToken.priceUsd);
  const projectedDebtAmount = new BigNumber(
    selectedMarketPosition?.balances.debt?.balance ?? 0
  ).plus(borrowAmount);
  const minLoan = new BigNumber(selectedMarket?.minLoan ?? 0);
  const projectedDebtBelowMinimum =
    borrowAmount.gt(0) &&
    isDebtBelowMarketMinimum({
      debt: projectedDebtAmount,
      minimum: minLoan,
    });
  const selectedCollateralTokenId = selectedCollateralToken
    ? decodeTokenId({
        address: selectedCollateralToken.token.address,
        symbol: selectedCollateralToken.token.symbol,
      })
    : null;
  const riskChanges: RiskChange[] = [
    ...(selectedMarket && borrowAmount.gt(0)
      ? [
          {
            amount: borrowAmount.toNumber(),
            marketId: selectedMarket.id,
            type: "borrow" as const,
          },
        ]
      : []),
    ...(selectedCollateralTokenId && collateralAmount.gt(0)
      ? [
          {
            amount: collateralAmount.toNumber(),
            tokenId: selectedCollateralTokenId,
            type: "supply" as const,
          },
        ]
      : []),
  ];
  const riskAssessment = selectedMarketRisk?.assess(riskChanges) ?? null;
  const riskProjection = riskAssessment?.projection ?? {
    reason: "unknownMarket" as const,
    status: "unavailable" as const,
    totalCollateralUsd: null,
    totalDebtUsd: null,
  };
  const currentRisk = selectedMarketRisk?.current ?? null;
  const existingCollateralUsd = new BigNumber(
    currentRisk?.totalCollateralUsd ?? 0
  );
  const existingDebtUsd = new BigNumber(currentRisk?.totalDebtUsd ?? 0);
  const projectedCollateralUsd = new BigNumber(
    riskProjection.totalCollateralUsd ??
      existingCollateralUsd.plus(collateralUsd)
  );
  const projectedDebtUsd = new BigNumber(
    riskProjection.totalDebtUsd ?? existingDebtUsd.plus(borrowUsd)
  );
  const maxLtv =
    riskProjection.status === "available" ? riskProjection.maxLtv : null;
  const projectedHealthFactor =
    riskProjection.status === "available" ? riskProjection.healthFactor : null;
  const projectedLtv =
    riskProjection.status === "available" ? riskProjection.ltv : 0;
  const hasAmounts = borrowAmount.gt(0) || collateralAmount.gt(0);
  const ltvGreaterThanMax = hasAmounts && riskAssessment?.decision === "block";
  const hasValidationError =
    borrowAmountGreaterThanAvailable ||
    collateralAmountGreaterThanBalance ||
    ltvGreaterThanMax ||
    projectedDebtBelowMinimum;
  const isActionReady =
    !!selectedMarket &&
    !!selectedCollateralToken &&
    hasAmounts &&
    !hasValidationError;
  const projection: BorrowFormProjection = {
    borrowMaxAmount,
    borrowUsd,
    collateralMaxAmount,
    collateralUsd,
    existingCollateralUsd,
    existingDebtUsd,
    maxLtv,
    projectedCollateralUsd,
    projectedDebtUsd,
    projectedHealthFactor,
    projectedLtv,
    riskStatus: riskProjection.status,
  };

  return {
    borrowAmount,
    canSelectCollateralMaxAmount: !!selectedMarket && collateralMaxAmount.gt(0),
    catalogResetNotice: false,
    collateralAmount,
    integrationsResult,
    isActionReady,
    markets,
    marketsResult,
    preparedReviewState: getPreparedReviewState({
      borrowAmount,
      collateralAmount,
      isActionReady,
      projection,
      selectedCollateralToken,
      selectedIntegration,
      selectedMarket,
      walletAddress: key.scope.address,
    }),
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
