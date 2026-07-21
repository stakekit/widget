import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useBorrowTransactionFlowExecution } from "../react/borrow-flow-route";

export const useBorrowExecution = () => {
  const execution = useBorrowTransactionFlowExecution();
  const view = useAtomValue(execution.viewAtom);
  const dispatch = useAtomSet(execution.retryAtom);

  return {
    ...view,
    retry: () => dispatch({ _tag: "Retry" }),
  } as const;
};
