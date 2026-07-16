import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { initializeTransactionWorkflow } from "../../../../../services/workflow/transaction-workflow-model";
import { useClassicTransactionWorkflowKey } from "../../../react/classic-transaction-workflow-context";
import {
  classicTransactionWorkflowCompletionAtom,
  transactionWorkflowDispatchAtom,
  transactionWorkflowStateAtom,
} from "../../../state/transaction-workflow-atoms";

export const useTransactionWorkflow = () => {
  const workflowKey = useClassicTransactionWorkflowKey();
  useAtomMount(classicTransactionWorkflowCompletionAtom(workflowKey));
  const result = useAtomValue(transactionWorkflowStateAtom(workflowKey));
  const dispatch = useAtomSet(transactionWorkflowDispatchAtom(workflowKey));
  const state = Option.getOrElse(AsyncResult.value(result), () =>
    initializeTransactionWorkflow(workflowKey)
  );

  return {
    dispatch,
    result,
    state,
    workflowKey,
  } as const;
};
