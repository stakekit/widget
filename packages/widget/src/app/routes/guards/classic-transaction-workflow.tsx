import { useAtomValue } from "@effect/atom-react";
import { Navigate, Outlet } from "react-router";
import { ClassicTransactionWorkflowContext } from "../../../features/transaction-flow/react/classic-transaction-workflow-context";
import { classicTransactionFlowFacade } from "../../../features/transaction-flow/state/classic-flow-facade";
import { currentWalletScopeAtom } from "../../../features/wallet/state/selectors";
import { sameWalletScopeOwner } from "../../../services/wallet/domain/scope";

export const ClassicFlowTransactionWorkflowGuard = () => {
  const handoff = useAtomValue(
    classicTransactionFlowFacade.workflowHandoffAtom
  );
  const currentWalletScope = useAtomValue(currentWalletScopeAtom);

  if (
    !handoff ||
    !currentWalletScope ||
    !sameWalletScopeOwner(handoff.workflowKey.walletScope, currentWalletScope)
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ClassicTransactionWorkflowContext.Provider value={handoff}>
      <Outlet />
    </ClassicTransactionWorkflowContext.Provider>
  );
};
