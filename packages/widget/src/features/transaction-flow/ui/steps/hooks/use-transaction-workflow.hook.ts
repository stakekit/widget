import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { useClassicTransactionWorkflowFacade } from "../../../react/classic-transaction-workflow-context";

export const useTransactionWorkflow = () => {
  const facade = useClassicTransactionWorkflowFacade();
  useAtomMount(facade.completionAtom);
  const view = useAtomValue(facade.viewAtom);
  const dispatch = useAtomSet(facade.dispatchAtom);

  if (!view) {
    throw new Error("Classic transaction workflow has no attached action.");
  }

  return {
    dispatch,
    ...view,
  } as const;
};
