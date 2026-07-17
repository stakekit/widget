import { useAtomSet } from "@effect/atom-react";
import { enterStakeRequestAtom } from "../state/enter-request";
import { exitStakeRequestAtom } from "../state/exit-request";
import { pendingActionRequestAtom } from "../state/pending-action-request";

export const useSetEnterStakeRequest = () => useAtomSet(enterStakeRequestAtom);

export const useSetExitStakeRequest = () => useAtomSet(exitStakeRequestAtom);

export const useSetPendingActionRequest = () =>
  useAtomSet(pendingActionRequestAtom);
