import { make as makeScopedAtom } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { ClassicTransactionWorkflowKey } from "../../../services/workflow/transaction-workflow-model";
import { getTransactionWorkflowAtoms } from "../state/transaction-workflow-atoms";

export const ClassicTransactionWorkflowScope = makeScopedAtom(
  (workflowKey: ClassicTransactionWorkflowKey) => {
    const atoms = getTransactionWorkflowAtoms(workflowKey);

    return Atom.readable(() => ({ ...atoms, workflowKey }) as const).pipe(
      Atom.withLabel("classicTransactionWorkflowScope")
    );
  }
);
