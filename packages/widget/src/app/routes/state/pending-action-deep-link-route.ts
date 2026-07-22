import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { classicFlowSessionStore } from "../../../features/classic-transaction-flow/session";
import {
  type PendingActionDeepLinkIntentId,
  pendingActionDeepLinkViewAtom,
  samePendingActionDeepLinkIntent,
} from "../../../features/earn/pending-action-deep-link";
import { mountAnimationStateAtom } from "../../../features/mount-animation/public-state";
import {
  claimPendingActionNavigation,
  type PendingActionNavigation,
} from "./claim-pending-action-navigation";

type PendingActionDeepLinkRouteState = Readonly<{
  readonly claimedIntents: ReadonlyArray<PendingActionDeepLinkIntentId>;
  readonly navigation: PendingActionNavigation | null;
  readonly nextEpoch: number;
}>;

const pendingActionDeepLinkRouteStateAtom =
  Atom.make<PendingActionDeepLinkRouteState>({
    claimedIntents: [],
    navigation: null,
    nextEpoch: 1,
  }).pipe(Atom.withLabel("pendingActionDeepLinkRouteStateAtom"));

export const applyPendingActionDeepLinkNavigationAtom = Atom.fnSync(
  (
    input: {
      readonly epoch: number;
      readonly navigate: (path: string) => void;
    },
    context
  ) => {
    const state = context(pendingActionDeepLinkRouteStateAtom);
    const claim = claimPendingActionNavigation({
      navigation: state.navigation,
      requestedEpoch: input.epoch,
    });
    if (!claim.path) return;

    context.set(pendingActionDeepLinkRouteStateAtom, {
      ...state,
      navigation: claim.navigation,
    });
    input.navigate(claim.path);
  }
).pipe(Atom.withLabel("applyPendingActionDeepLinkNavigationAtom"));

export const canClaimPendingActionDeepLink = ({
  claimedIntents,
  currentIntent,
  requestedIntent,
}: {
  readonly claimedIntents: ReadonlyArray<PendingActionDeepLinkIntentId>;
  readonly currentIntent: PendingActionDeepLinkIntentId;
  readonly requestedIntent: PendingActionDeepLinkIntentId;
}) =>
  samePendingActionDeepLinkIntent(currentIntent, requestedIntent) &&
  !claimedIntents.some((claimed) =>
    samePendingActionDeepLinkIntent(claimed, requestedIntent)
  );

const claimPendingActionDeepLinkAtom = Atom.fnSync(
  (intentId: PendingActionDeepLinkIntentId, context) => {
    const current = context(pendingActionDeepLinkViewAtom).pipe(
      AsyncResult.value,
      Option.getOrUndefined
    );

    const state = context(pendingActionDeepLinkRouteStateAtom);
    if (
      !current ||
      !canClaimPendingActionDeepLink({
        claimedIntents: state.claimedIntents,
        currentIntent: current.intentId,
        requestedIntent: intentId,
      })
    ) {
      return;
    }

    const path =
      current.type === "positionDetails"
        ? `positions/${current.yieldOp.id}/${current.balanceId}/select-validator/${current.pendingAction.type}`
        : `positions/${current.yieldOp.id}/${current.balanceId}/pending-action/review`;

    if (current.type === "review") {
      context.set(classicFlowSessionStore.startAtom, {
        _tag: "Manage",
        request: current.pendingActionDto.requestDto,
        gasFeeToken: current.pendingActionDto.gasFeeToken,
        integration: current.pendingActionDto.integrationData,
        interactedToken: current.balance.token,
        pendingActionType: current.pendingActionDto.requestDto.action,
        providersDetails: current.providersDetails,
        walletScope: current.walletScope,
      });
    }

    context.set(pendingActionDeepLinkRouteStateAtom, {
      claimedIntents: [...state.claimedIntents, intentId],
      navigation: { epoch: state.nextEpoch, path },
      nextEpoch: state.nextEpoch + 1,
    });
  }
).pipe(Atom.withLabel("claimPendingActionDeepLinkAtom"));

export const pendingActionDeepLinkRouteAtom = Atom.make((context) => {
  const registry = context.registry;
  const claimCurrent = () => {
    const animation = registry.get(mountAnimationStateAtom);
    if (!animation.layout || !animation.earnPage) return;

    const current = registry
      .get(pendingActionDeepLinkViewAtom)
      .pipe(AsyncResult.value, Option.getOrUndefined);
    if (current) registry.set(claimPendingActionDeepLinkAtom, current.intentId);
  };

  context.subscribe(pendingActionDeepLinkViewAtom, claimCurrent, {
    immediate: true,
  });
  context.subscribe(mountAnimationStateAtom, claimCurrent, { immediate: true });

  return context(pendingActionDeepLinkRouteStateAtom).navigation;
}).pipe(Atom.withLabel("pendingActionDeepLinkRouteAtom"));
