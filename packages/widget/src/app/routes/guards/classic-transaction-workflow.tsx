import { useAtomValue } from "@effect/atom-react";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { Navigate, Outlet } from "react-router";
import {
  ClassicFlowExecutionContext,
  ClassicTransactionWorkflowContext,
} from "../../../features/transaction-flow/react/classic-transaction-workflow-context";
import { classicTransactionFlowFacade } from "../../../features/transaction-flow/state/classic-flow-facade";
import { currentWalletScopeAtom } from "../../../features/wallet/state/selectors";
import { sameWalletScopeOwner } from "../../../services/wallet/domain/scope";
import type { ClassicTransactionWorkflowKey } from "../../../services/workflow/transaction-workflow-model";

export const ClassicFlowTransactionWorkflowGuard = ({
  workflowKeyAtom,
}: {
  readonly workflowKeyAtom: Atom.Atom<ClassicTransactionWorkflowKey | null>;
}) => {
  const workflowKey = useAtomValue(workflowKeyAtom);
  const activeFlow = useAtomValue(classicTransactionFlowFacade.activeFlowAtom);
  const currentWalletScope = useAtomValue(currentWalletScopeAtom);

  if (
    !workflowKey ||
    !currentWalletScope ||
    !sameWalletScopeOwner(workflowKey.walletScope, currentWalletScope)
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ClassicFlowExecutionContext.Provider value={activeFlow?.identity ?? null}>
      <ClassicTransactionWorkflowContext.Provider value={workflowKey}>
        <Outlet />
      </ClassicTransactionWorkflowContext.Provider>
    </ClassicFlowExecutionContext.Provider>
  );
};
