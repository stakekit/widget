import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import {
  earnPageInputAtom,
  earnPageQuoteAtom,
  earnPageSelectionAtom,
} from "../../page-workflow";
import {
  earnMachineIntentAtom,
  earnMachineRetryTargetAtom,
  earnMachineViewAtom,
} from "../machine/atoms";

export const useEarnMachine = () => {
  const view = useAtomValue(earnMachineViewAtom);
  const dispatch = useAtomSet(earnMachineIntentAtom);
  const retryTarget = useAtomValue(earnMachineRetryTargetAtom);
  const retry = useAtomRefresh(retryTarget);
  const input = useAtomValue(earnPageInputAtom);
  const quote = useAtomValue(earnPageQuoteAtom);
  const selection = useAtomValue(earnPageSelectionAtom);

  return {
    input,
    quote,
    selection,
    view,
    dispatch,
    retry,
  };
};
