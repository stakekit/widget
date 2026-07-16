import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { initializeTransactionWorkflow } from "../../../../../services/workflow/transaction-workflow-model";
import { ClassicTransactionWorkflowScope } from "../../../react/classic-transaction-workflow-scope";

export const useTransactionWorkflow = () => {
  const atoms = useAtomValue(ClassicTransactionWorkflowScope.use());
  useAtomMount(atoms.classicCompletionAtom);
  const result = useAtomValue(atoms.stateAtom);
  const dispatch = useAtomSet(atoms.dispatchAtom);
  const state = Option.getOrElse(AsyncResult.value(result), () =>
    initializeTransactionWorkflow(atoms.workflowKey)
  );

  return {
    dispatch,
    result,
    state,
    workflowKey: atoms.workflowKey,
  } as const;
};
