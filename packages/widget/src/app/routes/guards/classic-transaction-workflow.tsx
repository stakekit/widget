import { useAtomValue } from "@effect/atom-react";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { Navigate, Outlet } from "react-router";
import { ClassicTransactionWorkflowContext } from "../../../features/transaction-flow/react/classic-transaction-workflow-context";
import type { ClassicTransactionWorkflowKey } from "../../../services/workflow/transaction-workflow-model";

export const ClassicTransactionWorkflowGuard = ({
  workflowKeyAtom,
}: {
  readonly workflowKeyAtom: Atom.Atom<ClassicTransactionWorkflowKey | null>;
}) => {
  const workflowKey = useAtomValue(workflowKeyAtom);

  if (!workflowKey) return <Navigate to="/" replace />;

  return (
    <ClassicTransactionWorkflowContext.Provider value={workflowKey}>
      <Outlet />
    </ClassicTransactionWorkflowContext.Provider>
  );
};
