import { useAtomMount, useAtomValue } from "@effect/atom-react";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { Navigate, Outlet } from "react-router";
import { ClassicTransactionWorkflowContext } from "../../../features/transaction-flow/react/classic-transaction-workflow-context";
import { currentWalletScopeAtom } from "../../../features/wallet";
import { sameWalletScopeOwner } from "../../../services/wallet/domain/scope";
import type { ClassicTransactionWorkflowKey } from "../../../services/workflow/transaction-workflow-model";

export const ClassicTransactionWorkflowGuard = ({
  workflowLifecycleAtom,
  workflowKeyAtom,
}: {
  readonly workflowLifecycleAtom: Atom.Atom<void>;
  readonly workflowKeyAtom: Atom.Atom<ClassicTransactionWorkflowKey | null>;
}) => {
  useAtomMount(workflowLifecycleAtom);
  const workflowKey = useAtomValue(workflowKeyAtom);
  const currentWalletScope = useAtomValue(currentWalletScopeAtom);

  if (
    !workflowKey ||
    !currentWalletScope ||
    !sameWalletScopeOwner(workflowKey.walletScope, currentWalletScope)
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <ClassicTransactionWorkflowContext.Provider value={workflowKey}>
      <Outlet />
    </ClassicTransactionWorkflowContext.Provider>
  );
};
