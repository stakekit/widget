import { useAtomSet } from "@effect/atom-react";
import { classicTransactionFlowFacade } from "../state/classic-flow-facade";
import { exitStakeRequestAtom } from "../state/exit-request";
import { pendingActionRequestAtom } from "../state/pending-action-request";

export const useStartClassicTransactionFlow = () =>
  useAtomSet(classicTransactionFlowFacade.startAtom);

export const useSetExitStakeRequest = () => useAtomSet(exitStakeRequestAtom);

export const useSetPendingActionRequest = () =>
  useAtomSet(pendingActionRequestAtom);
