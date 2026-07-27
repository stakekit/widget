import type BigNumber from "bignumber.js";
import { Data, Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../app/config/settings";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { BorrowFeatureDisabled } from "../../../domain/borrow/availability";
import type { CollateralToken } from "../../../domain/borrow/collateral-token";
import { isBorrowNetwork } from "../../../domain/borrow/network";
import { TrackingService } from "../../../services/tracking/tracking-service";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import { startBorrowTransactionFlowAtom } from "../../borrow-transaction-flow/state";
import { tokenBalancesScanAtom } from "../../portfolio/state";
import { walletScopeAtom } from "../../wallet/state";
import {
  applyBorrowFormAction,
  BorrowDashboardKey,
  type BorrowDashboardView,
  type BorrowFormAction,
  type BorrowFormIntent,
  makeDefaultBorrowFormIntent,
  resolveBorrowDashboardView,
} from "../model/borrow-form";
import { borrowActionFormAtom } from "./action-form";
import {
  BorrowMarketsKey,
  BorrowPositionsKey,
  borrowIntegrationsAtom,
  borrowMarketsAtom,
  borrowPositionsAtom,
} from "./resources";

class BorrowFormScopeKey extends Data.Class<{
  readonly scope: WalletScopeKey;
}> {}

const borrowFormIntentAtom = Atom.family((_scope: BorrowFormScopeKey) =>
  Atom.make<BorrowFormIntent>(makeDefaultBorrowFormIntent())
);

const borrowDashboardAtom = Atom.family((key: BorrowDashboardKey) => {
  const scope = new BorrowFormScopeKey({
    scope: key.scope,
  });

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
              scope: key.scope,
            })
          )
        ),
        tokenBalances:
          AsyncResult.getOrElse(
            context.get(tokenBalancesScanAtom).result,
            () => []
          ) ?? [],
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

const currentBorrowDashboardKeyAtom = Atom.make((get) => {
  if (!get(widgetConfigAtom).borrowEnabled) return null;

  const scope = get(walletScopeAtom);

  return scope && isBorrowNetwork(scope.network)
    ? new BorrowDashboardKey({
        network: scope.network,
        scope,
      })
    : null;
}).pipe(Atom.withLabel("currentBorrowDashboardKeyAtom"));

export const currentBorrowDashboardAtom = Atom.writable<
  BorrowDashboardView | null,
  BorrowFormAction
>(
  (context) => {
    const key = context.get(currentBorrowDashboardKeyAtom);

    return key ? context.get(borrowDashboardAtom(key)) : null;
  },
  (context, action) => {
    const key = context.get(currentBorrowDashboardKeyAtom);

    if (key) context.set(borrowDashboardAtom(key), action);
  }
).pipe(Atom.withLabel("currentBorrowDashboardAtom"));

export const setBorrowAmountAtom = Atom.fnSync((amount: BigNumber, context) =>
  context.set(currentBorrowDashboardAtom, {
    amount,
    type: "borrowAmount/set",
  })
).pipe(Atom.withLabel("setBorrowAmountAtom"));

export const setBorrowCollateralAmountAtom = Atom.fnSync(
  (amount: BigNumber, context) =>
    context.set(currentBorrowDashboardAtom, {
      amount,
      type: "collateralAmount/set",
    })
).pipe(Atom.withLabel("setBorrowCollateralAmountAtom"));

export const setBorrowCollateralMaxAmountAtom = appRuntime
  .fn((_input: undefined, context) => {
    const view = context(currentBorrowDashboardAtom);

    if (!view?.canSelectCollateralMaxAmount || !view.selectedMarket) {
      return Effect.void;
    }

    context.set(currentBorrowDashboardAtom, {
      amount: view.projection.collateralMaxAmount,
      type: "collateralAmount/set",
    });

    return TrackingService.use((tracking) =>
      tracking.trackEvent("borrowPageMaxClicked", {
        collateralTokenAddress: view.selectedCollateralToken?.token.address,
        collateralTokenSymbol: view.selectedCollateralToken?.token.symbol,
        field: "collateral",
        marketId: view.selectedMarket?.id,
      })
    );
  })
  .pipe(Atom.withLabel("setBorrowCollateralMaxAmountAtom"));

export const selectBorrowMarketAtom = appRuntime
  .fn((marketId: string, context) => {
    context.set(currentBorrowDashboardAtom, {
      marketId,
      type: "market/select",
    });

    return TrackingService.use((tracking) =>
      tracking.trackEvent("borrowMarketSelected", { marketId })
    );
  })
  .pipe(Atom.withLabel("selectBorrowMarketAtom"));

export const selectBorrowCollateralTokenAtom = appRuntime
  .fn((collateralToken: CollateralToken, context) => {
    const marketId = context(currentBorrowDashboardAtom)?.selectedMarket?.id;

    context.set(currentBorrowDashboardAtom, {
      tokenAddress: collateralToken.token.address ?? null,
      type: "collateralToken/select",
    });

    return TrackingService.use((tracking) =>
      tracking.trackEvent("borrowCollateralSelected", {
        collateralTokenAddress: collateralToken.token.address,
        collateralTokenSymbol: collateralToken.token.symbol,
        marketId,
      })
    );
  })
  .pipe(Atom.withLabel("selectBorrowCollateralTokenAtom"));

export const startBorrowDashboardReviewAtom = appRuntime
  .fn((_input: undefined, context) => {
    if (!context(widgetConfigAtom).borrowEnabled) {
      return Effect.fail(
        new BorrowFeatureDisabled({
          message: "Borrow is disabled by Widget configuration.",
        })
      );
    }

    const view = context(currentBorrowDashboardAtom);
    const preparedReviewState = view?.preparedReviewState;

    if (!view?.isActionReady || !preparedReviewState || !view.selectedMarket) {
      return Effect.void;
    }

    context.set(borrowActionFormAtom, {
      reviewState: preparedReviewState,
      type: "prepareReview",
    });
    context.set(startBorrowTransactionFlowAtom, {
      ...preparedReviewState,
      entry: { _tag: "BorrowDashboard" },
    });

    return TrackingService.use((tracking) =>
      tracking.trackEvent("borrowReviewClicked", {
        borrowAmount: view.borrowAmount.toString(10),
        collateralAmount: view.collateralAmount.toString(10),
        collateralTokenAddress: view.selectedCollateralToken?.token.address,
        collateralTokenSymbol: view.selectedCollateralToken?.token.symbol,
        marketId: view.selectedMarket?.id,
      })
    );
  })
  .pipe(Atom.withLabel("startBorrowDashboardReviewAtom"));
