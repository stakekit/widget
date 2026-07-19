import { useAtomMount, useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { Navigate, Outlet } from "react-router";
import type { ClassicTransactionWorkflowKey } from "../../../services/workflow/transaction-workflow-model";
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

export const EnterStakeRequestRouteGuard = enterFlowRoute.RouteGuard;
export const ExitStakeRequestRouteGuard = exitFlowRoute.RouteGuard;
export const PendingActionRequestRouteGuard = manageFlowRoute.RouteGuard;

export const useRequiredEnterClassicTransactionFlow =
  enterFlowRoute.useRequiredValue;
export const useRequiredExitClassicTransactionFlow =
  exitFlowRoute.useRequiredValue;
export const useRequiredManageClassicTransactionFlow =
  manageFlowRoute.useRequiredValue;

const classicFlowWorkflowKeyAtom = <Flow extends ClassicTransactionFlow>(
  flowAtom: Atom.Atom<Flow | null>,
  label: string
): Atom.Atom<ClassicTransactionWorkflowKey | null> =>
  Atom.make((get) => {
    const flow = get(flowAtom);
    const handoff = get(classicTransactionFlowFacade.workflowHandoffAtom);

    return flow && handoff?.flowIdentity === flow.identity
      ? handoff.workflowKey
      : null;
  }).pipe(Atom.withLabel(label));

export const enterClassicFlowWorkflowKeyAtom = classicFlowWorkflowKeyAtom(
  classicTransactionFlowFacade.enterFlowAtom,
  "enterClassicFlowWorkflowKeyAtom"
);
export const exitClassicFlowWorkflowKeyAtom = classicFlowWorkflowKeyAtom(
  classicTransactionFlowFacade.exitFlowAtom,
  "exitClassicFlowWorkflowKeyAtom"
);
export const manageClassicFlowWorkflowKeyAtom = classicFlowWorkflowKeyAtom(
  classicTransactionFlowFacade.manageFlowAtom,
  "manageClassicFlowWorkflowKeyAtom"
);
