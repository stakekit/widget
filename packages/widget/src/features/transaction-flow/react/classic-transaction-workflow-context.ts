import { createContext, useContext } from "react";
import type { ClassicTransactionFlowWorkflowHandoff } from "../model/classic-transaction-flow";

export const ClassicTransactionWorkflowContext =
  createContext<ClassicTransactionFlowWorkflowHandoff | null>(null);

export const useClassicTransactionWorkflowHandoff = () => {
  const handoff = useContext(ClassicTransactionWorkflowContext);

  if (!handoff) {
    throw new Error("Classic transaction workflow used outside its provider.");
  }

  return handoff;
};
