import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { enterStakeRequestAtom } from "../state/enter-request";
import { exitStakeRequestAtom } from "../state/exit-request";
import { pendingActionRequestAtom } from "../state/pending-action-request";

export const useEnterStakeRequest = () => useAtomValue(enterStakeRequestAtom);

export const useSetEnterStakeRequest = () => useAtomSet(enterStakeRequestAtom);

export const useExitStakeRequest = () => useAtomValue(exitStakeRequestAtom);

export const useSetExitStakeRequest = () => useAtomSet(exitStakeRequestAtom);

export const usePendingActionRequest = () =>
  useAtomValue(pendingActionRequestAtom);

export const useSetPendingActionRequest = () =>
  useAtomSet(pendingActionRequestAtom);
