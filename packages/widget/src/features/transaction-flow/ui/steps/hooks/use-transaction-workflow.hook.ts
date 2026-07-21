import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useClassicFlowExecution } from "../../../react/classic-flow-route";

export const useTransactionWorkflow = () => {
  const facade = useClassicFlowExecution().workflow;
  const view = useAtomValue(facade.viewAtom);
  const dispatch = useAtomSet(facade.dispatchAtom);

  return {
    dispatch,
    ...view,
  } as const;
};
