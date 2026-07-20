import { useAtomSet } from "@effect/atom-react";
import { classicFlowSessionStore } from "../state/classic-flow-session-store";

export const useStartClassicTransactionFlow = () =>
  useAtomSet(classicFlowSessionStore.startAtom);
