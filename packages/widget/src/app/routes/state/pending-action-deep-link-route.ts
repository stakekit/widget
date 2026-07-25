import { Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  classicFlowSessionStore,
  makeClassicTransactionFlowDestination,
} from "../../../features/classic-transaction-flow/facade";
import {
  type PendingActionDeepLinkIntentId,
  pendingActionDeepLinkViewAtom,
  samePendingActionDeepLinkIntent,
} from "../../../features/earn/pending-action-deep-link";
import { initParamsAtom } from "../../../features/init-params/atoms";
import { mountAnimationStateAtom } from "../../../features/mount-animation/public-state";
import { walletConnectionStateAtom } from "../../../features/wallet/public-state";
import { toWidgetPath } from "../../../services/navigation/widget-navigation";
import { appRuntime } from "../../runtime/app-runtime";
import { runWidgetNavigationCommand } from "../../runtime/navigation";

type PendingActionDeepLinkRouteState = Readonly<{
  readonly claimedIntents: ReadonlyArray<PendingActionDeepLinkIntentId>;
  readonly claimedPositionIntents: ReadonlyArray<string>;
}>;

const pendingActionDeepLinkRouteStateAtom =
  Atom.make<PendingActionDeepLinkRouteState>({
    claimedIntents: [],
    claimedPositionIntents: [],
  }).pipe(Atom.withLabel("pendingActionDeepLinkRouteStateAtom"));

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

const claimPendingActionDeepLinkAtom = appRuntime
  .fn((intentId: PendingActionDeepLinkIntentId, context) => {
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
      return Effect.void;
    }

    const positionBase =
      `/positions/${current.yieldOp.id}/${current.balanceId}` as const;
    const path = toWidgetPath(
      current.type === "positionDetails"
        ? `${positionBase}/select-validator/${current.pendingAction.type}`
        : `${positionBase}/pending-action/review`
    );

    if (current.type === "review") {
      const destination = makeClassicTransactionFlowDestination({
        routeBase: `${positionBase}/pending-action`,
      });
      context.set(classicFlowSessionStore.startAtom, {
        destination,
        intake: {
          _tag: "Manage",
          request: current.pendingActionDto.requestDto,
          gasFeeToken: current.pendingActionDto.gasFeeToken,
          integration: current.pendingActionDto.integrationData,
          interactedToken: current.balance.token,
          pendingActionType: current.pendingActionDto.requestDto.action,
          providersDetails: current.providersDetails,
          walletScope: current.walletScope,
        },
      });
    }

    context.set(pendingActionDeepLinkRouteStateAtom, {
      ...state,
      claimedIntents: [...state.claimedIntents, intentId],
    });
    return runWidgetNavigationCommand({ _tag: "Push", path });
  })
  .pipe(Atom.withLabel("claimPendingActionDeepLinkAtom"));

const claimPositionDeepLinkAtom = appRuntime
  .fn((_input: undefined, context) => {
    const initParams = context(initParamsAtom);
    const wallet = context(walletConnectionStateAtom);
    if (
      wallet.status !== "connected" ||
      !initParams?.yieldId ||
      !initParams.balanceId ||
      initParams.pendingaction
    ) {
      return Effect.void;
    }

    const intent = `${initParams.yieldId}:${initParams.balanceId}`;
    const state = context(pendingActionDeepLinkRouteStateAtom);
    if (state.claimedPositionIntents.includes(intent)) return Effect.void;

    context.set(pendingActionDeepLinkRouteStateAtom, {
      ...state,
      claimedPositionIntents: [...state.claimedPositionIntents, intent],
    });
    return runWidgetNavigationCommand({
      _tag: "Push",
      path: toWidgetPath(
        `/positions/${initParams.yieldId}/${initParams.balanceId}`
      ),
    });
  })
  .pipe(Atom.withLabel("claimPositionDeepLinkAtom"));

export const pendingActionDeepLinkRouteAtom = Atom.make((context) => {
  const registry = context.registry;
  context.mount(claimPendingActionDeepLinkAtom);
  context.mount(claimPositionDeepLinkAtom);
  const claimCurrent = () => {
    const animation = registry.get(mountAnimationStateAtom);
    if (!animation.layout || !animation.earnPage) return;

    registry.set(claimPositionDeepLinkAtom, undefined);
    const current = registry
      .get(pendingActionDeepLinkViewAtom)
      .pipe(AsyncResult.value, Option.getOrUndefined);
    if (current) registry.set(claimPendingActionDeepLinkAtom, current.intentId);
  };

  context.subscribe(pendingActionDeepLinkViewAtom, claimCurrent, {
    immediate: true,
  });
  context.subscribe(initParamsAtom, claimCurrent, { immediate: true });
  context.subscribe(mountAnimationStateAtom, claimCurrent, { immediate: true });
  context.subscribe(walletConnectionStateAtom, claimCurrent, {
    immediate: true,
  });

  return undefined;
}).pipe(Atom.withLabel("pendingActionDeepLinkRouteAtom"));
