import { makeWalletScopedAtomRoute } from "../../wallet/react/wallet-scoped-atom-route";
import {
  enterStakeRequestAtom,
  enterTransactionWorkflowLifecycleAtom,
} from "../state/enter-request";
import {
  exitStakeRequestAtom,
  exitTransactionWorkflowLifecycleAtom,
} from "../state/exit-request";
import {
  pendingActionRequestAtom,
  pendingTransactionWorkflowLifecycleAtom,
} from "../state/pending-action-request";

const enterStakeRequestRoute = makeWalletScopedAtomRoute(
  enterStakeRequestAtom,
  enterTransactionWorkflowLifecycleAtom,
  "EnterStakeRequest"
);
const exitStakeRequestRoute = makeWalletScopedAtomRoute(
  exitStakeRequestAtom,
  exitTransactionWorkflowLifecycleAtom,
  "ExitStakeRequest"
);
const pendingActionRequestRoute = makeWalletScopedAtomRoute(
  pendingActionRequestAtom,
  pendingTransactionWorkflowLifecycleAtom,
  "PendingActionRequest"
);

export const EnterStakeRequestRouteGuard = enterStakeRequestRoute.RouteGuard;
export const ExitStakeRequestRouteGuard = exitStakeRequestRoute.RouteGuard;
export const PendingActionRequestRouteGuard =
  pendingActionRequestRoute.RouteGuard;

export const useRequiredEnterStakeRequest =
  enterStakeRequestRoute.useRequiredValue;
export const useRequiredExitStakeRequest =
  exitStakeRequestRoute.useRequiredValue;
export const useRequiredPendingActionRequest =
  pendingActionRequestRoute.useRequiredValue;
