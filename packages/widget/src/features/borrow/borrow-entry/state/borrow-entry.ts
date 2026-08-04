import type BigNumber from "bignumber.js";
import { Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../../app/config/settings";
import { appRuntime } from "../../../../app/runtime/app-runtime";
import { BorrowFeatureDisabled } from "../../../../domain/borrow/availability";
import type { CollateralToken } from "../../../../domain/borrow/catalog/collateral-token";
import { decodeTokenId } from "../../../../domain/borrow/ids";
import {
  type BorrowNetwork,
  isBorrowNetwork,
} from "../../../../domain/borrow/network";
import { TrackingService } from "../../../../services/tracking/tracking-service";
import {
  sameWalletScopeOwner,
  type WalletScopeOwnerKey,
  walletScopeOwnerKey,
} from "../../../../services/wallet/domain/scope";
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

type BorrowFormOwner = Readonly<{
  readonly address: WalletScopeOwnerKey["address"];
  readonly network: BorrowNetwork;
}>;

type BorrowFormState = {
  readonly catalogResetNotice: boolean;
  readonly intent: BorrowFormIntent;
  readonly owner: BorrowFormOwner;
};

const makeDefaultBorrowFormState = (
  owner: BorrowFormOwner
): BorrowFormState => ({
  catalogResetNotice: false,
  intent: makeDefaultBorrowFormIntent(),
  owner,
});

const getBorrowFormOwner = (
  scope: ReturnType<typeof walletScopeOwnerKey> | null
): BorrowFormOwner | null =>
  scope && isBorrowNetwork(scope.network)
    ? { address: scope.address, network: scope.network }
    : null;

export const resetBorrowEntryIntentForOwnerAtom = Atom.fnSync(
  (owner: WalletScopeOwnerKey, context) => {
    const scope = context(walletScopeAtom);
    const currentOwner = getBorrowFormOwner(
      scope ? walletScopeOwnerKey(scope) : null
    );
    if (!currentOwner || !sameWalletScopeOwner(currentOwner, owner)) return;

    context.set(borrowFormStateAtom, { type: "reset" });
  }
).pipe(Atom.withLabel("resetBorrowEntryIntentForOwnerAtom"));

const borrowFormStateAtom = Atom.writable<
  BorrowFormState | null,
  BorrowFormAction
>(
  (context) => {
    const scope = context.get(walletScopeAtom);
    const owner = getBorrowFormOwner(scope ? walletScopeOwnerKey(scope) : null);
    if (!owner) return null;

    const previous = context
      .self<BorrowFormState | null>()
      .pipe(Option.getOrNull);
    const reconciled =
      previous && sameWalletScopeOwner(previous.owner, owner)
        ? previous
        : makeDefaultBorrowFormState(owner);
    const marketsResult = context.get(
      borrowMarketsAtom(new BorrowMarketsKey({ network: owner.network }))
    );
    const shouldReset =
      AsyncResult.isSuccess(marketsResult) &&
      !marketsResult.waiting &&
      shouldResetBorrowFormForCatalog({
        intent: reconciled.intent,
        markets: marketsResult.value,
      });

    return shouldReset
      ? {
          catalogResetNotice: true,
          intent: makeDefaultBorrowFormIntent(),
          owner,
        }
      : reconciled;
  },
  (context, action) => {
    const scope = context.get(walletScopeAtom);
    const owner = getBorrowFormOwner(scope ? walletScopeOwnerKey(scope) : null);
    if (!owner) {
      context.setSelf(null);
      return;
    }
    if (action.type === "reset") {
      context.setSelf(makeDefaultBorrowFormState(owner));
      return;
    }

    const state = context.get(borrowFormStateAtom);
    const current =
      state && sameWalletScopeOwner(state.owner, owner)
        ? state
        : makeDefaultBorrowFormState(owner);
    const marketsResult = context.get(
      borrowMarketsAtom(new BorrowMarketsKey({ network: owner.network }))
    );
    const shouldPinDefaults = action.type !== "market/select";
    const intent =
      shouldPinDefaults && AsyncResult.isSuccess(marketsResult)
        ? pinBorrowFormDefaults({
            intent: current.intent,
            markets: marketsResult.value,
          })
        : current.intent;

    context.setSelf({
      catalogResetNotice: false,
      intent: applyBorrowFormAction({ action, intent }),
      owner,
    });
  }
).pipe(Atom.setIdleTTL(0), Atom.withLabel("borrowFormStateAtom"));

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
    const state = context.get(borrowFormStateAtom);
    const key = context.get(currentBorrowEntryKeyAtom);
    if (!key || !state) return null;
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
          borrowPositionsAtom(new BorrowPositionsKey({ scope: key.scope }))
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
  (context, action) => {
    if (context.get(currentBorrowEntryKeyAtom)) {
      context.set(borrowFormStateAtom, action);
    }
  }
).pipe(Atom.setIdleTTL(0), Atom.withLabel("currentBorrowEntryAtom"));

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
      tokenId: decodeTokenId(collateralToken.token),
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
        return { _tag: "Unavailable" } as const;
      }

      const entry = { _tag: "BorrowEntry" as const };
      const intake = {
        ...preparation.review,
        entry,
      };
      return yield* context.setResult(startBorrowTransactionFlowAtom, intake);
    })
  )
  .pipe(Atom.withLabel("startBorrowEntryReviewAtom"));
