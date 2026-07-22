import { useAtomSet } from "@effect/atom-react";
import { classicFlowSessionStore } from "../session";

export const useStartClassicTransactionFlow = () =>
  useAtomSet(classicFlowSessionStore.startAtom);
