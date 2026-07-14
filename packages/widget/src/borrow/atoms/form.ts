import BigNumber from "bignumber.js";
import { Data } from "effect";
import type { AsyncResult as AtomAsyncResult } from "effect/unstable/reactivity/AsyncResult";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { TokenBalance } from "../../domain/schema/financial-models";
import type { WalletAddress } from "../../domain/schema/identifiers";
import {
  type BorrowMarketWalletBalances,
  deriveBorrowMarketWalletBalances,
} from "../balances";
import {
  type BorrowNetwork,
  buildBorrowActionRequest,
  type CollateralToken,
  decodeBorrowForm,
  type Integration,
  type Market,
  type Position,
  projectLtvRatio,
} from "../domain";
import {
  type BorrowAtomResultError,
  BorrowMarketsKey,
  BorrowPositionsKey,
  borrowIntegrationsAtom,
  borrowMarketsAtom,
  borrowPositionsAtom,
} from "./resources";

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

export type BorrowPreparedReviewState = {
  readonly request: ReturnType<typeof buildBorrowActionRequest>;
  readonly summary: {
    readonly action: "borrow" | "borrowAndSupply" | "supply";
    readonly borrowAmount?: string;
    readonly collateralAmount?: string;
    readonly collateralTokenSymbol?: string;
    readonly existingCollateralUsd?: string;
    readonly existingDebtUsd?: string;
    readonly projectedCollateralUsd?: string;
    readonly projectedDebtUsd?: string;
    readonly projectedHealthFactor?: string;
    readonly projectedLtv?: string;
    readonly loanTokenSymbol?: string;
    readonly marketLabel: string;
    readonly network: string;
    readonly providerName: string;
  };
};

export type BorrowFormValidation = {
  readonly borrowAmountGreaterThanAvailable: boolean;
  readonly collateralAmountGreaterThanBalance: boolean;
  readonly hasAmounts: boolean;
  readonly hasValidationError: boolean;
  readonly ltvGreaterThanMax: boolean;
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
};

export type BorrowDashboardView = {
  readonly borrowAmount: BigNumber;
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
  readonly preparedReviewState: BorrowPreparedReviewState | null;
  readonly projection: BorrowFormProjection;
  readonly selectedCollateralBalance:
    | BorrowMarketWalletBalances["selectedCollateralToken"]
    | null;
  readonly selectedCollateralToken: CollateralToken | null;
  readonly selectedCollateralTokenAddress: string | null;
  readonly selectedIntegration: Integration | null;
  readonly selectedMarket: Market | null;
  readonly selectedMarketPosition: Position | null;
  readonly selectedMarketId: string | null;
  readonly validation: BorrowFormValidation;
  readonly walletBalances: BorrowMarketWalletBalances | null;
};

export class BorrowFormScopeKey extends Data.Class<{
  readonly scopeId: string;
}> {}

export class BorrowDashboardKey extends Data.Class<{
  readonly network: BorrowNetwork;
  readonly scopeId: string;
  readonly tokenBalances: ReadonlyArray<TokenBalance>;
  readonly walletAddress: WalletAddress;
}> {}

export const makeDefaultBorrowFormIntent = (): BorrowFormIntent => ({
  borrowAmount: "0",
  collateralAmount: "0",
  selectedCollateralTokenAddress: null,
  selectedMarketId: null,
});

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

const borrowFormIntentAtom = Atom.family((_scope: BorrowFormScopeKey) =>
  Atom.make<BorrowFormIntent>(makeDefaultBorrowFormIntent())
);

const getSelectedMarket = ({
  intent,
  markets,
}: {
  readonly intent: BorrowFormIntent;
  readonly markets: ReadonlyArray<Market>;
}) =>
  markets.find((market) => market.id === intent.selectedMarketId) ??
  markets[0] ??
  null;

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

  return (
    selectedMarket.collateralTokens.find(
      (collateralToken) =>
        collateralToken.token.address === intent.selectedCollateralTokenAddress
    ) ??
    selectedMarket.collateralTokens[0] ??
    null
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
}): BorrowPreparedReviewState | null => {
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

  const summaryAction =
    form._tag === "BorrowPlusCollateral"
      ? "borrowAndSupply"
      : form._tag === "BorrowOnly"
        ? "borrow"
        : "supply";

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
      ...(projection.projectedHealthFactor == null
        ? {}
        : {
            projectedHealthFactor: projection.projectedHealthFactor.toString(),
          }),
      projectedLtv: projection.projectedLtv.toString(),
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
  positionsResult = AsyncResult.success([]),
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
    ReadonlyArray<Position>,
    BorrowAtomResultError
  >;
}): BorrowDashboardView => {
  const markets = AsyncResult.getOrElse(marketsResult, () => []);
  const integrations = AsyncResult.getOrElse(integrationsResult, () => []);
  const positions = AsyncResult.getOrElse(positionsResult, () => []);
  const selectedMarket = getSelectedMarket({ intent, markets });
  const selectedMarketId = selectedMarket?.id ?? null;
  const selectedMarketPosition = selectedMarket
    ? (positions.find((position) => position.id === selectedMarket.id) ?? null)
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
        balances: key.tokenBalances,
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
  const existingCollateralUsd = new BigNumber(
    selectedMarketPosition?.getTotalCollateralUsd() ?? 0
  );
  const existingDebtUsd = new BigNumber(
    selectedMarketPosition?.getTotalBorrowedUsd() ?? 0
  );
  const projectedCollateralUsd = existingCollateralUsd.plus(collateralUsd);
  const projectedDebtUsd = existingDebtUsd.plus(borrowUsd);
  const projectedLtv = projectLtvRatio({
    collateralUsd: projectedCollateralUsd.toNumber(),
    debtUsd: projectedDebtUsd.toNumber(),
  });
  const existingCollateralDetails =
    selectedMarketPosition?.getCollateralTokenDetails();
  const existingMaxLtv = existingCollateralDetails?.maxLtv;
  const maxLtvCandidate =
    selectedCollateralToken?.maxLtv ??
    (existingMaxLtv != null && Number.isFinite(existingMaxLtv)
      ? existingMaxLtv
      : selectedMarket?.getMaxLtv());
  const maxLtv =
    maxLtvCandidate != null && Number.isFinite(maxLtvCandidate)
      ? maxLtvCandidate
      : null;
  const liquidationThresholdCandidate =
    selectedCollateralToken?.liquidationThreshold ??
    existingCollateralDetails?.liquidationThreshold ??
    selectedMarket?.getLiquidationThreshold();
  const liquidationThreshold =
    liquidationThresholdCandidate != null &&
    Number.isFinite(liquidationThresholdCandidate)
      ? liquidationThresholdCandidate
      : null;
  const projectedHealthFactor =
    projectedLtv > 0 && liquidationThreshold != null
      ? liquidationThreshold / projectedLtv
      : null;
  const hasAmounts = borrowAmount.gt(0) || collateralAmount.gt(0);
  const ltvGreaterThanMax =
    maxLtv != null && hasAmounts && projectedLtv > maxLtv;
  const hasValidationError =
    borrowAmountGreaterThanAvailable ||
    collateralAmountGreaterThanBalance ||
    ltvGreaterThanMax;
  const isActionReady =
    !!selectedMarket &&
    !!selectedCollateralToken &&
    hasAmounts &&
    !hasValidationError;

  return {
    borrowAmount,
    collateralAmount,
    integrationsResult,
    isActionReady,
    markets,
    marketsResult,
    preparedReviewState: getPreparedReviewState({
      borrowAmount,
      collateralAmount,
      isActionReady,
      projection: {
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
      },
      selectedCollateralToken,
      selectedIntegration,
      selectedMarket,
      walletAddress: key.walletAddress,
    }),
    projection: {
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
    },
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
    },
    walletBalances,
  };
};

export const borrowDashboardAtom = Atom.family((key: BorrowDashboardKey) => {
  const scope = new BorrowFormScopeKey({ scopeId: key.scopeId });

  return Atom.writable<BorrowDashboardView, BorrowFormAction>(
    (context) =>
      resolveBorrowDashboardView({
        integrationsResult: context.get(borrowIntegrationsAtom),
        intent: context.get(borrowFormIntentAtom(scope)),
        key,
        marketsResult: context.get(
          borrowMarketsAtom(new BorrowMarketsKey({ network: key.network }))
        ),
        positionsResult: context.get(
          borrowPositionsAtom(
            new BorrowPositionsKey({
              address: key.walletAddress,
              network: key.network,
            })
          )
        ),
      }),
    (context, action) => {
      const intentAtom = borrowFormIntentAtom(scope);
      const intent = context.get(intentAtom);

      context.set(
        intentAtom,
        applyBorrowFormAction({
          action,
          intent,
        })
      );
    }
  );
});
