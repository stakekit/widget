import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { useBorrowTransactionFlowExecution } from "./borrow-flow-session";

export const useBorrowExecution = () => {
  const execution = useBorrowTransactionFlowExecution();
  const view = useAtomValue(execution.viewAtom);
  const dispatch = useAtomSet(execution.dispatchAtom);

  return {
    ...view,
    retry: () => dispatch({ _tag: "Retry" }),
  } as const;
};
