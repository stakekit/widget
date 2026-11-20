import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { pendingActionDeepLinkViewAtom } from "../../../features/earn/index";
import { initParamsAtom } from "../../../features/init-params/index";
import { mountAnimationStateAtom } from "../../../features/mount-animation/index";
import { walletConnectionStateAtom } from "../../../features/wallet/index";
import { makeManageIntake } from "../../../features/yield-transaction-flow/index";
import { underMaintenanceAtom } from "../../../resources/widget-health/widget-health";
import {
  atomToStream,
  makeScopedEffectAtom,
} from "../../../runtime/scoped-effect-atom";
import {
  DeepLinkCoordinator,
  type DeepLinkRouteObservation,
  type PendingActionDeepLinkObservation,
} from "../../runtime/deep-link-coordinator";
import { deepLinkRuntime } from "../../runtime/deep-link-runtime";

type PendingActionDeepLinkView =
  Atom.Type<
    typeof pendingActionDeepLinkViewAtom
  > extends AsyncResult.AsyncResult<infer Value, infer _Error>
    ? NonNullable<Value>
    : never;

/** What a resolved pending-action deep link asks the coordinator to do. */
export const toPendingActionDeepLinkObservation = (
  value: PendingActionDeepLinkView
): PendingActionDeepLinkObservation => {
  if (value.type === "positionDetails") {
    return {
      _tag: "OpenValidatorSelection",
      balanceId: value.balanceId,
      intent: value.intentId,
      pendingActionType: value.pendingAction.type,
      walletScope: value.walletScope,
      yieldId: value.yieldOp.id,
    };
  }

  return {
    _tag: "StartYieldFlow",
    input: {
      intake: makeManageIntake({
        balance: value.balance,
        pendingActionType: value.pendingAction.command.action,
        prepared: value.pendingAction,
        providersDetails: value.providersDetails,
        walletScope: value.walletScope,
      }),
      mount: {
        _tag: "PositionManage",
        balanceId: value.balanceId,
        integrationId: value.yieldOp.id,
      },
    },
    intent: value.intentId,
    walletScope: value.walletScope,
  };
};

const deepLinkRouteObservationAtom = Atom.make<DeepLinkRouteObservation>(
  (get) => {
    const animation = get(mountAnimationStateAtom);
    const initParams = get(initParamsAtom);
    const maintenance = get(underMaintenanceAtom);
    const wallet = get(walletConnectionStateAtom);
    const pendingActionValue = get(pendingActionDeepLinkViewAtom).pipe(
      AsyncResult.value,
      Option.getOrNull
    );
    const pendingAction = pendingActionValue
      ? toPendingActionDeepLinkObservation(pendingActionValue)
      : null;
    const position =
      wallet.status === "connected" &&
      initParams?.yieldId &&
      initParams.balanceId &&
      !initParams.pendingaction
        ? {
            balanceId: initParams.balanceId,
            yieldId: initParams.yieldId,
          }
        : null;

    return {
      maintenance,
      pendingAction,
      position,
      ready: animation.layout && animation.earnPage,
    };
  }
).pipe(Atom.withLabel("deepLinkRouteObservationAtom"));

export const pendingActionDeepLinkRouteAtom = makeScopedEffectAtom({
  acquire: (context) =>
    DeepLinkCoordinator.use((coordinator) =>
      coordinator.observe(atomToStream(context, deepLinkRouteObservationAtom))
    ),
  label: "pendingActionDeepLinkRoute",
  makeValue: () => undefined,
  runtime: deepLinkRuntime,
});
