import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { useClassicTransactionWorkflowHandoff } from "../../../react/classic-transaction-workflow-context";
import {
  classicTransactionWorkflowCompletionAtom,
  classicTransactionWorkflowDispatchAtom,
  classicTransactionWorkflowViewAtom,
} from "../../../state/transaction-workflow-atoms";

export const useTransactionWorkflow = () => {
  const handoff = useClassicTransactionWorkflowHandoff();
  useAtomMount(classicTransactionWorkflowCompletionAtom(handoff));
  const view = useAtomValue(classicTransactionWorkflowViewAtom(handoff));
  const dispatch = useAtomSet(classicTransactionWorkflowDispatchAtom(handoff));

  return {
    dispatch,
    ...view,
  } as const;
};
