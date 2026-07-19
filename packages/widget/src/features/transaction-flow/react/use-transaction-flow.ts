import { useAtomSet } from "@effect/atom-react";
import { classicTransactionFlowFacade } from "../state/classic-flow-facade";

export const useStartClassicTransactionFlow = () =>
  useAtomSet(classicTransactionFlowFacade.startAtom);
