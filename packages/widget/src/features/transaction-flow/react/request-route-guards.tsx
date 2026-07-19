import { useAtomMount, useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { Navigate, Outlet } from "react-router";
import type { ClassicTransactionWorkflowKey } from "../../../services/workflow/transaction-workflow-model";
import { makeRequiredAtomRoute } from "../../../shared/react/required-atom-route";
import { useWalletScopeRoute } from "../../wallet/react/wallet-scope-route";
import { makeWalletScopedAtomRoute } from "../../wallet/react/wallet-scoped-atom-route";
import {
  type ClassicTransactionFlow,
  isClassicTransactionFlowWalletScopeValid,
} from "../model/classic-transaction-flow";
import { classicTransactionFlowFacade } from "../state/classic-flow-facade";
import {
  exitStakeRequestAtom,
  exitTransactionWorkflowLifecycleAtom,
} from "../state/exit-request";
import {
  pendingActionRequestAtom,
  pendingTransactionWorkflowLifecycleAtom,
} from "../state/pending-action-request";

const enterFlowRoute = makeRequiredAtomRoute(
  classicTransactionFlowFacade.enterFlowAtom,
  "EnterClassicTransactionFlow"
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

type EnterClassicTransactionFlow = Extract<
  ClassicTransactionFlow,
  { readonly _tag: "Enter" }
>;

const EnterFlowLifecycle = ({
  flow,
}: {
  readonly flow: EnterClassicTransactionFlow;
}) => {
  useAtomMount(classicTransactionFlowFacade.lifecycleAtom(flow.identity));

  return (
    <enterFlowRoute.Provider value={flow}>
      <Outlet />
    </enterFlowRoute.Provider>
  );
};

export const EnterStakeRequestRouteGuard = () => {
  const flow = useAtomValue(classicTransactionFlowFacade.enterFlowAtom);
  const walletScope = useWalletScopeRoute();

  if (!flow || !isClassicTransactionFlowWalletScopeValid(flow, walletScope)) {
    return <Navigate to="/" replace />;
  }

  return <EnterFlowLifecycle flow={flow} />;
};
export const ExitStakeRequestRouteGuard = exitStakeRequestRoute.RouteGuard;
export const PendingActionRequestRouteGuard =
  pendingActionRequestRoute.RouteGuard;

export const useRequiredEnterClassicTransactionFlow =
  enterFlowRoute.useRequiredValue;
export const useRequiredExitStakeRequest =
  exitStakeRequestRoute.useRequiredValue;
export const useRequiredPendingActionRequest =
  pendingActionRequestRoute.useRequiredValue;

export const enterClassicFlowWorkflowKeyAtom: Atom.Atom<ClassicTransactionWorkflowKey | null> =
  Atom.make((get) => {
    const flow = get(classicTransactionFlowFacade.enterFlowAtom);
    const handoff = get(classicTransactionFlowFacade.workflowHandoffAtom);

    return flow && handoff?.flowIdentity === flow.identity
      ? handoff.workflowKey
      : null;
  }).pipe(Atom.withLabel("enterClassicFlowWorkflowKeyAtom"));
