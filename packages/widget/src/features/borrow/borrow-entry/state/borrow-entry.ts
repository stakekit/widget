import type BigNumber from "bignumber.js";
import { Data, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../../app/config/settings";
import { appRuntime } from "../../../../app/runtime/app-runtime";
import { BorrowFeatureDisabled } from "../../../../domain/borrow/availability";
import type { CollateralToken } from "../../../../domain/borrow/catalog/collateral-token";
import {
  type BorrowNetwork,
  isBorrowNetwork,
} from "../../../../domain/borrow/network";
import { TrackingService } from "../../../../services/tracking/tracking-service";
import { walletScopeOwnerKey } from "../../../../services/wallet/domain/scope";
import { startBorrowTransactionFlowAtom } from "../../../borrow-transaction-flow/state";
import { tokenBalancesScanAtom } from "../../../portfolio/state";
import { walletScopeAtom } from "../../../wallet/state";
import {
  BorrowMarketsKey,
  BorrowPositionsKey,
  borrowIntegrationsAtom,
  borrowMarketsAtom,
  borrowPositionsAtom,
} from "../../positions/state/positions";
import {
  applyBorrowFormAction,
  BorrowEntryKey,
  type BorrowEntryView,
  type BorrowFormAction,
  type BorrowFormIntent,
  makeDefaultBorrowFormIntent,
  pinBorrowFormDefaults,
  resolveBorrowEntryView,
  shouldResetBorrowFormForCatalog,
} from "../model/borrow-entry";

class BorrowFormOwnerKey extends Data.Class<{
  readonly address: ReturnType<typeof walletScopeOwnerKey>["address"];
  readonly network: BorrowNetwork;
}> {}

type BorrowFormState = {
  readonly catalogResetNotice: boolean;
  readonly intent: BorrowFormIntent;
};

const makeDefaultBorrowFormState = (): BorrowFormState => ({
  catalogResetNotice: false,
  intent: makeDefaultBorrowFormIntent(),
});

const borrowFormStateAtom = Atom.family((key: BorrowFormOwnerKey) =>
  Atom.writable<BorrowFormState, BorrowFormAction>(
    (context) => {
      const previous = context
        .self<BorrowFormState>()
        .pipe(Option.getOrElse(makeDefaultBorrowFormState));
      const marketsResult = context.get(
        borrowMarketsAtom(new BorrowMarketsKey({ network: key.network }))
      );
      const shouldReset =
        AsyncResult.isSuccess(marketsResult) &&
        !marketsResult.waiting &&
        shouldResetBorrowFormForCatalog({
          intent: previous.intent,
          markets: marketsResult.value,
        });

      return shouldReset
        ? {
            catalogResetNotice: true,
            intent: makeDefaultBorrowFormIntent(),
          }
        : previous;
    },
    (context, action) => {
      const state = context.get(borrowFormStateAtom(key));
      const marketsResult = context.get(
        borrowMarketsAtom(new BorrowMarketsKey({ network: key.network }))
      );
      const shouldPinDefaults =
        action.type !== "reset" && action.type !== "market/select";
      const intent =
        shouldPinDefaults && AsyncResult.isSuccess(marketsResult)
          ? pinBorrowFormDefaults({
              intent: state.intent,
              markets: marketsResult.value,
            })
          : state.intent;

      context.setSelf({
        catalogResetNotice: false,
        intent: applyBorrowFormAction({
          action,
          intent,
        }),
      });
    }
  )
);

const borrowEntryAtom = Atom.family((key: BorrowEntryKey) => {
  const owner = walletScopeOwnerKey(key.scope);
  const formOwner = new BorrowFormOwnerKey({
    address: owner.address,
    network: key.network,
  });

  return Atom.writable<BorrowEntryView, BorrowFormAction>(
    (context) => {
      const stateAtom = borrowFormStateAtom(formOwner);
      const state = context.get(stateAtom);
      const marketsResult = context.get(
        borrowMarketsAtom(new BorrowMarketsKey({ network: key.network }))
      );

      return {
        ...resolveBorrowEntryView({
          integrationsResult: context.get(borrowIntegrationsAtom),
          intent: state.intent,
          key,
          marketsResult,
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
        catalogResetNotice: state.catalogResetNotice,
      };
    },
    (context, action) => context.set(borrowFormStateAtom(formOwner), action)
  );
});

const currentBorrowEntryKeyAtom = Atom.make((get) => {
  if (!get(widgetConfigAtom).borrowEnabled) return null;

  const scope = get(walletScopeAtom);

  return scope && isBorrowNetwork(scope.network)
    ? new BorrowEntryKey({
        network: scope.network,
        scope,
      })
    : null;
}).pipe(Atom.withLabel("currentBorrowEntryKeyAtom"));

export const currentBorrowEntryAtom = Atom.writable<
  BorrowEntryView | null,
  BorrowFormAction
>(
  (context) => {
    const key = context.get(currentBorrowEntryKeyAtom);

    return key ? context.get(borrowEntryAtom(key)) : null;
  },
  (context, action) => {
    const key = context.get(currentBorrowEntryKeyAtom);

    if (key) context.set(borrowEntryAtom(key), action);
  }
).pipe(Atom.withLabel("currentBorrowEntryAtom"));

export const setBorrowAmountAtom = Atom.fnSync((amount: BigNumber, context) =>
  context.set(currentBorrowEntryAtom, {
    amount,
    type: "borrowAmount/set",
  })
).pipe(Atom.withLabel("setBorrowAmountAtom"));

export const setBorrowCollateralAmountAtom = Atom.fnSync(
  (amount: BigNumber, context) =>
    context.set(currentBorrowEntryAtom, {
      amount,
      type: "collateralAmount/set",
    })
).pipe(Atom.withLabel("setBorrowCollateralAmountAtom"));

export const setBorrowCollateralMaxAmountAtom = appRuntime
  .fn((_input: undefined, context) => {
    const view = context(currentBorrowEntryAtom);

    if (!view?.canSelectCollateralMaxAmount || !view.selectedMarket) {
      return Effect.void;
    }

    context.set(currentBorrowEntryAtom, {
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
    context.set(currentBorrowEntryAtom, {
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
    const marketId = context(currentBorrowEntryAtom)?.selectedMarket?.id;

    context.set(currentBorrowEntryAtom, {
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

export const startBorrowEntryReviewAtom = appRuntime
  .fn((_input: undefined, context) =>
    Effect.gen(function* () {
      if (!context(widgetConfigAtom).borrowEnabled) {
        return yield* new BorrowFeatureDisabled({
          message: "Borrow is disabled by Widget configuration.",
        });
      }

      const view = context(currentBorrowEntryAtom);
      const preparation = view?.preparation;

      if (
        !view?.isActionReady ||
        preparation?._tag !== "Ready" ||
        !view.selectedMarket
      ) {
        return;
      }

      const entry = { _tag: "BorrowEntry" as const };
      const intake = {
        ...preparation.review,
        entry,
      };
      yield* context.setResult(startBorrowTransactionFlowAtom, intake);
    })
  )
  .pipe(Atom.withLabel("startBorrowEntryReviewAtom"));
