import { createContext, useContext } from "react";
import type { ClassicTransactionWorkflowFacade } from "../state/transaction-workflow-atoms";

export const ClassicTransactionWorkflowContext =
  createContext<ClassicTransactionWorkflowFacade | null>(null);

export const useClassicTransactionWorkflowFacade = () => {
  const facade = useContext(ClassicTransactionWorkflowContext);

  if (!facade) {
    throw new Error("Classic transaction workflow used outside its provider.");
  }

  return facade;
};
