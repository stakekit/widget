import { useAtomMount, useAtomValue } from "@effect/atom-react";
import { Navigate, Outlet } from "react-router";
import { useClassicFlowSessionFacade } from "../../../features/transaction-flow/react/classic-flow-session-context";
import { ClassicTransactionWorkflowContext } from "../../../features/transaction-flow/react/classic-transaction-workflow-context";
import { currentWalletScopeAtom } from "../../../features/wallet/state/selectors";
import { sameWalletScopeOwner } from "../../../services/wallet/domain/scope";

export const ClassicFlowTransactionWorkflowGuard = () => {
  const facade = useClassicFlowSessionFacade();
  useAtomMount(facade.stepsRouteAtom);
  const workflowKey = useAtomValue(facade.workflowKeyAtom);
  const currentWalletScope = useAtomValue(currentWalletScopeAtom);

  if (
    !workflowKey ||
    !currentWalletScope ||
    !sameWalletScopeOwner(workflowKey.walletScope, currentWalletScope)
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ClassicTransactionWorkflowContext.Provider value={facade.workflow}>
      <Outlet />
    </ClassicTransactionWorkflowContext.Provider>
  );
};
