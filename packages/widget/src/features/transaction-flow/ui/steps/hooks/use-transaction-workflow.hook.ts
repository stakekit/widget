import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useContext } from "react";
import { initializeTransactionWorkflow } from "../../../../../services/workflow/transaction-workflow-model";
import { ClassicTransactionWorkflowScope } from "../../../react/classic-transaction-workflow-scope";

export const useTransactionWorkflow = () => {
  const scopeAtom = useContext(ClassicTransactionWorkflowScope.Context);
  if (!scopeAtom) {
    throw new Error("Classic transaction workflow used outside its provider.");
  }
  const atoms = useAtomValue(scopeAtom);
  useAtomMount(atoms.classicCompletionAtom);
  const result = useAtomValue(atoms.stateAtom);
  const dispatch = useAtomSet(atoms.dispatchAtom);
  const state = Option.getOrElse(AsyncResult.value(result), () =>
    initializeTransactionWorkflow(atoms.workflowKey)
  );

  return {
    dispatch,
    result,
    state,
    workflowKey: atoms.workflowKey,
  } as const;
};
