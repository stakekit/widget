import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { pendingActionDeepLinkViewAtom } from "../../../features/earn/index";
import { initParamsAtom } from "../../../features/init-params/index";
import { mountAnimationStateAtom } from "../../../features/mount-animation/index";
import { walletConnectionStateAtom } from "../../../features/wallet/index";
import {
  DeepLinkCoordinator,
  type DeepLinkRouteObservation,
  type PendingActionDeepLinkObservation,
} from "../../runtime/deep-link-coordinator";
import {
  atomToStream,
  makeScopedEffectAtom,
} from "../../runtime/scoped-effect-atom";
import { walletRuntime } from "../../runtime/wallet-runtime";

const deepLinkRouteObservationAtom = Atom.make<DeepLinkRouteObservation>(
  (get) => {
    const animation = get(mountAnimationStateAtom);
    const initParams = get(initParamsAtom);
    const wallet = get(walletConnectionStateAtom);
    const pendingActionValue = get(pendingActionDeepLinkViewAtom).pipe(
      AsyncResult.value,
      Option.getOrNull
    );
    const pendingAction = ((): PendingActionDeepLinkObservation | null => {
      if (!pendingActionValue) return null;
      if (pendingActionValue.type === "positionDetails") {
        return {
          _tag: "OpenValidatorSelection",
          balanceId: pendingActionValue.balanceId,
          intent: pendingActionValue.intentId,
          pendingActionType: pendingActionValue.pendingAction.type,
          walletScope: pendingActionValue.walletScope,
          yieldId: pendingActionValue.yieldOp.id,
        };
      }

      return {
        _tag: "StartClassicFlow",
        input: {
          intake: {
            _tag: "Manage",
            request: pendingActionValue.pendingAction.command,
            gasFeeToken: pendingActionValue.pendingAction.gasFeeToken,
            integration: pendingActionValue.pendingAction.integrationData,
            interactedToken: pendingActionValue.balance.token,
            pendingActionType: pendingActionValue.pendingAction.command.action,
            providersDetails: pendingActionValue.providersDetails,
            walletScope: pendingActionValue.walletScope,
          },
          mount: {
            _tag: "PositionManage",
            balanceId: pendingActionValue.balanceId,
            integrationId: pendingActionValue.yieldOp.id,
          },
        },
        intent: pendingActionValue.intentId,
        walletScope: pendingActionValue.walletScope,
      };
    })();
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
  runtime: walletRuntime,
});
