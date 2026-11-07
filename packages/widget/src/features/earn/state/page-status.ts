import { Equal } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Reactivity from "effect/reactivity/Reactivity";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { resourceInvalidationKeys } from "../../../services/resource-invalidation";
import { toPresentable } from "../../../shared/effect/async-result";
import {
  isMountAnimationFinished,
  mountAnimationStateAtom,
} from "../../mount-animation/index";
import {
  walletConfigResultAtom,
  walletConnectionStateAtom,
  walletScopeAtom,
} from "../../wallet/index";
import { earnSelectionStatusViewAtom } from "./earn-selection";
import { earnPageSelectionAtom } from "./page-workflow";
import { pendingActionDeepLinkViewAtom } from "./pending-action-deep-link";

/**
 * Whether the Earn page can present yet. It reads the selection, never the
 * amount, and compares structurally, so typing an amount leaves its readers
 * alone.
 */
export const earnAppLoadingAtom = Atom.make((get) => {
  const selectedToken = get(earnPageSelectionAtom).token?.token ?? null;
  const wallet = get(walletConnectionStateAtom);
  const walletConfig = get(walletConfigResultAtom);
  const presentationFrozen = !isMountAnimationFinished(
    get(mountAnimationStateAtom)
  );

  return {
    isLoading:
      !selectedToken ||
      toPresentable(walletConfig)._tag === "Loading" ||
      AsyncResult.isInitial(get(pendingActionDeepLinkViewAtom)) ||
      wallet.status === "connecting",
    /** A loaded wallet config is revalidating: presentable, not submittable. */
    isRefreshing: walletConfig.waiting,
    presentationFrozen,
  } as const;
}).pipe(Atom.withEquality(Equal.equals), Atom.withLabel("earnAppLoadingAtom"));

export const earnPageStatusViewAtom = Atom.make((get) => {
  const status = get(earnSelectionStatusViewAtom);
  return {
    hasNoYields: status.empty.yields,
    isError: status.blockingFailure,
    presentationFrozen: get(earnAppLoadingAtom).presentationFrozen,
  } as const;
}).pipe(
  Atom.withEquality(Equal.equals),
  Atom.withLabel("earnPageStatusViewAtom")
);

/**
 * Loads what the Earn page reads again after it failed to load: the yields
 * catalog (yields, the tokens that earn in them and their validators) and the
 * wallet's balances and positions. What still shows keeps its value while it
 * reloads.
 */
export const retryEarnPageAtom = appRuntime
  .fn((_input: undefined, get) => {
    const scope = get(walletScopeAtom);
    return Reactivity.Reactivity.use((reactivity) =>
      reactivity.invalidate([
        ...resourceInvalidationKeys.yieldCatalog(),
        ...resourceInvalidationKeys.walletBalances(scope),
        ...resourceInvalidationKeys.yieldPositions(scope),
      ])
    );
  })
  .pipe(Atom.withLabel("retryEarnPageAtom"));
