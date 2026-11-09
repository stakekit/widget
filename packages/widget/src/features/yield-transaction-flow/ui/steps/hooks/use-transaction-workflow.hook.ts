import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { useYieldFlowExecution } from "../../yield-flow-session";

export const useTransactionWorkflow = () => {
  const facade = useYieldFlowExecution().workflow;
  const view = useAtomValue(facade.viewAtom);
  const dispatch = useAtomSet(facade.dispatchAtom);

  return {
    dispatch,
    ...view,
  } as const;
};
