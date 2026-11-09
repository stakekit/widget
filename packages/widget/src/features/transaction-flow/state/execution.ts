import { Effect, type Scope, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";

import { walletRuntime } from "../../../runtime/wallet-runtime";
import type { TransactionWorkflowCommand } from "../../../services/transaction-workflow/transaction-workflow-model";
import type {
  TransactionWorkflowHandle,
  TransactionWorkflowService,
} from "../../../services/transaction-workflow/transaction-workflow-service";

/**
 * Whether Steps and Complete can show their Execution: `Failed` leaves the
 * flow, `Starting` renders nothing until it runs.
 */
export type TransactionFlowExecutionStatus = "Failed" | "Running" | "Starting";

/**
 * An Execution's workflow as Atoms: `start` runs while something reads
 * `workflowAtom` or `stateAtom`, and ends when nothing does. `stateAtom`
 * follows its states; `dispatchAtom` sends it commands one at a time.
 * `label` prefixes their labels.
 */
export const makeTransactionFlowWorkflowAtoms = <E>(
  start: Effect.Effect<
    TransactionWorkflowHandle,
    E,
    Scope.Scope | TransactionWorkflowService
  >,
  label: string
) => {
  const workflowAtom = walletRuntime
    .atom(start)
    .pipe(Atom.withLabel(`${label}Workflow`));
  return {
    dispatchAtom: walletRuntime
      .fn(
        (command: TransactionWorkflowCommand, get) =>
          get
            .result(workflowAtom)
            .pipe(Effect.flatMap((workflow) => workflow.dispatch(command))),
        { concurrent: false, initialValue: undefined }
      )
      .pipe(Atom.withLabel(`${label}Dispatch`)),
    stateAtom: walletRuntime
      .atom((get) =>
        Stream.unwrap(
          get
            .result(workflowAtom)
            .pipe(Effect.map((workflow) => workflow.states))
        )
      )
      .pipe(Atom.withLabel(`${label}State`)),
    workflowAtom,
  } as const;
};
