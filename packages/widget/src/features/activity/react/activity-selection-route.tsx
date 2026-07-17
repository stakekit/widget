import { makeWalletScopedAtomRoute } from "../../wallet/react/wallet-scoped-atom-route";
import {
  activitySelectionAtom,
  activityTransactionWorkflowLifecycleAtom,
} from "../state/selection";

const activitySelectionRoute = makeWalletScopedAtomRoute(
  activitySelectionAtom,
  activityTransactionWorkflowLifecycleAtom,
  "ActivitySelection"
);

export const ActivitySelectionProvider = activitySelectionRoute.Provider;
export const ActivitySelectionRouteGuard = activitySelectionRoute.RouteGuard;
export const useRequiredActivitySelection =
  activitySelectionRoute.useRequiredValue;
