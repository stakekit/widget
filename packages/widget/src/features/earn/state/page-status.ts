import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  isMountAnimationFinished,
  mountAnimationStateAtom,
} from "../../mount-animation/index";
import {
  walletConfigResultAtom,
  walletConnectionStateAtom,
} from "../../wallet/index";
import { earnSelectionStatusViewAtom } from "./earn-selection";
import { earnPageQuoteAtom } from "./page-workflow";
import { pendingActionDeepLinkViewAtom } from "./pending-action-deep-link";

export const earnAppLoadingAtom = Atom.make((get) => {
  const selectedToken = get(earnPageQuoteAtom).selectedToken;
  const wallet = get(walletConnectionStateAtom);
  const walletConfig = get(walletConfigResultAtom);
  const presentationFrozen = !isMountAnimationFinished(
    get(mountAnimationStateAtom)
  );

  return {
    isLoading:
      !selectedToken ||
      AsyncResult.isInitial(walletConfig) ||
      walletConfig.waiting ||
      AsyncResult.isInitial(get(pendingActionDeepLinkViewAtom)) ||
      wallet.status === "connecting",
    presentationFrozen,
  } as const;
}).pipe(Atom.withLabel("earnAppLoadingAtom"));

export const earnPageStatusViewAtom = Atom.make((get) => {
  const status = get(earnSelectionStatusViewAtom);
  return {
    hasNoYields: status.empty.yields,
    isError: status.blockingFailure,
    presentationFrozen: get(earnAppLoadingAtom).presentationFrozen,
  } as const;
}).pipe(Atom.withLabel("earnPageStatusViewAtom"));
