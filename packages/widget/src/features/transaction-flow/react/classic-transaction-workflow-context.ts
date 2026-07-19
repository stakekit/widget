import { createContext, useContext } from "react";
import type { ClassicTransactionWorkflowKey } from "../../../services/workflow/transaction-workflow-model";
import type { ClassicTransactionFlowIdentity } from "../model/classic-transaction-flow";

export const ClassicTransactionWorkflowContext =
  createContext<ClassicTransactionWorkflowKey | null>(null);

export const ClassicFlowExecutionContext =
  createContext<ClassicTransactionFlowIdentity | null>(null);

export const useClassicTransactionWorkflowKey = () => {
  const workflowKey = useContext(ClassicTransactionWorkflowContext);

  if (!workflowKey) {
    throw new Error("Classic transaction workflow used outside its provider.");
  }

  return workflowKey;
};

export const useClassicFlowExecutionIdentity = () =>
  useContext(ClassicFlowExecutionContext);
