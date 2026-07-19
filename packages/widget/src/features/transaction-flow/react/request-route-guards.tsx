import { useAtomMount, useAtomValue } from "@effect/atom-react";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { Navigate, Outlet } from "react-router";
import { makeRequiredAtomRoute } from "../../../shared/react/required-atom-route";
import { useWalletScopeRoute } from "../../wallet/react/wallet-scope-route";
import {
  type ClassicTransactionFlow,
  isClassicTransactionFlowWalletScopeValid,
} from "../model/classic-transaction-flow";
import { classicTransactionFlowFacade } from "../state/classic-flow-facade";

const makeClassicFlowRoute = <Flow extends ClassicTransactionFlow>(
  flowAtom: Atom.Atom<Flow | null>,
  name: string
) => {
  const requiredRoute = makeRequiredAtomRoute(flowAtom, name);

  const Lifecycle = ({ flow }: { readonly flow: Flow }) => {
    useAtomMount(classicTransactionFlowFacade.lifecycleAtom(flow.identity));

    return (
      <requiredRoute.Provider value={flow}>
        <Outlet />
      </requiredRoute.Provider>
    );
  };

  const RouteGuard = () => {
    const flow = useAtomValue(flowAtom);
    const walletScope = useWalletScopeRoute();

    if (!flow || !isClassicTransactionFlowWalletScopeValid(flow, walletScope)) {
      return <Navigate to="/" replace />;
    }

    return <Lifecycle flow={flow} />;
  };

  Lifecycle.displayName = `${name}Lifecycle`;
  RouteGuard.displayName = `${name}RouteGuard`;

  return { RouteGuard, useRequiredValue: requiredRoute.useRequiredValue };
};

const enterFlowRoute = makeClassicFlowRoute(
  classicTransactionFlowFacade.enterFlowAtom,
  "EnterClassicTransactionFlow"
);
const exitFlowRoute = makeClassicFlowRoute(
  classicTransactionFlowFacade.exitFlowAtom,
  "ExitClassicTransactionFlow"
);
const manageFlowRoute = makeClassicFlowRoute(
  classicTransactionFlowFacade.manageFlowAtom,
  "ManageClassicTransactionFlow"
);
const activityResumeFlowRoute = makeClassicFlowRoute(
  classicTransactionFlowFacade.activityResumeFlowAtom,
  "ActivityResumeClassicTransactionFlow"
);

export const EnterStakeRequestRouteGuard = enterFlowRoute.RouteGuard;
export const ExitStakeRequestRouteGuard = exitFlowRoute.RouteGuard;
export const PendingActionRequestRouteGuard = manageFlowRoute.RouteGuard;
export const ActivitySelectionRouteGuard = activityResumeFlowRoute.RouteGuard;

export const useRequiredEnterClassicTransactionFlow =
  enterFlowRoute.useRequiredValue;
export const useRequiredExitClassicTransactionFlow =
  exitFlowRoute.useRequiredValue;
export const useRequiredManageClassicTransactionFlow =
  manageFlowRoute.useRequiredValue;
export const useRequiredActivityResumeClassicTransactionFlow =
  activityResumeFlowRoute.useRequiredValue;
