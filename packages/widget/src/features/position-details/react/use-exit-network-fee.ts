import { useAtomValue } from "@effect/atom-react";
import { positionDetailsExitNetworkFeeAtom } from "../state/details-view";
import { useExitOrPendingAction } from "./use-exit-or-pending-action";

/** What the exit as typed is estimated to cost the network, once known. */
export const useExitNetworkFee = () => {
  const { workflowKey } = useExitOrPendingAction();
  return useAtomValue(positionDetailsExitNetworkFeeAtom(workflowKey));
};
