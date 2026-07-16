import { useAtomValue } from "@effect/atom-react";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { Navigate, Outlet } from "react-router";
import { ClassicTransactionWorkflowScope } from "../../../features/transaction-flow/react/classic-transaction-workflow-scope";
import type { ClassicTransactionWorkflowKey } from "../../../services/workflow/transaction-workflow-model";
import { getTransactionWorkflowId } from "../../../services/workflow/transaction-workflow-model";

export const ClassicTransactionWorkflowGuard = ({
  workflowKeyAtom,
}: {
  readonly workflowKeyAtom: Atom.Atom<ClassicTransactionWorkflowKey | null>;
}) => {
  const workflowKey = useAtomValue(workflowKeyAtom);

  if (!workflowKey) return <Navigate to="/" replace />;

  return (
    <ClassicTransactionWorkflowScope.Provider
      key={getTransactionWorkflowId(workflowKey)}
      value={workflowKey}
    >
      <Outlet />
    </ClassicTransactionWorkflowScope.Provider>
  );
};
