import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useYieldFlowExecution } from "../../../react/yield-flow-route";

export const useTransactionWorkflow = () => {
  const facade = useYieldFlowExecution().workflow;
  const view = useAtomValue(facade.viewAtom);
  const dispatch = useAtomSet(facade.dispatchAtom);

  return {
    dispatch,
    ...view,
  } as const;
};
