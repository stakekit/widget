import { Effect, type Scope, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { walletRuntime } from "../../../runtime/wallet-runtime";
import {
  WidgetNavigation,
  type WidgetNavigationCommand,
} from "../../../services/navigation/widget-navigation";
import type {
  TransactionWorkflowCommand,
  TransactionWorkflowState,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import type {
  TransactionWorkflowHandle,
  TransactionWorkflowService,
} from "../../../services/transaction-workflow/transaction-workflow-service";

/**
 * Whether Steps and Complete can show their Execution: `Failed` leaves the
 * flow, `Starting` shows it is on its way until it runs.
 */
export type TransactionFlowExecutionStatus = "Failed" | "Running" | "Starting";

/**
 * Runs a navigation to its end: a started router navigation cannot be
 * cancelled, so a page that ends meanwhile waits for it instead of
 * abandoning it mid-flight.
 */
export const navigateTransactionFlow = (command: WidgetNavigationCommand) =>
  WidgetNavigation.use((navigation) =>
    Effect.uninterruptible(navigation.execute(command))
  );

/**
 * An Execution's workflow as Atoms: `start` runs while something reads
 * `workflowAtom` or `stateAtom`, and ends when nothing does. `stateAtom`
 * follows its states; `dispatchAtom` sends it commands one at a time.
 * `executionStatusAtom` says whether it started, and `completionAtom` whether
 * `isFinished` holds for its state; it has none while a confidential
 * preparation runs first. `label` prefixes their labels.
 */
export const makeTransactionFlowWorkflowAtoms = <E>(
  start: Effect.Effect<
    TransactionWorkflowHandle,
    E,
    Scope.Scope | TransactionWorkflowService
  >,
  {
    isFinished,
    label,
  }: {
    readonly isFinished: (state: TransactionWorkflowState) => boolean;
    readonly label: string;
  }
) => {
  const workflowAtom = walletRuntime
    .atom(start)
    .pipe(Atom.withLabel(`${label}Workflow`));
  const stateAtom = walletRuntime
    .atom((get) =>
      Stream.unwrap(
        get.result(workflowAtom).pipe(Effect.map((workflow) => workflow.states))
      )
    )
    .pipe(Atom.withLabel(`${label}State`));
  return {
    completionAtom: Atom.make((get) => {
      const state = get(stateAtom);
      return AsyncResult.isSuccess(state) && isFinished(state.value);
    }).pipe(Atom.withLabel(`${label}Completion`)),
    dispatchAtom: walletRuntime
      .fn(
        (command: TransactionWorkflowCommand, get) =>
          get
            .result(workflowAtom)
            .pipe(Effect.flatMap((workflow) => workflow.dispatch(command))),
        { concurrent: false, initialValue: undefined }
      )
      .pipe(Atom.withLabel(`${label}Dispatch`)),
    /**
     * `Failed` when the Execution cannot start or its workflow fails to run,
     * such as on input that proves invalid after confidential steps;
     * `Starting` until it runs.
     */
    executionStatusAtom: Atom.make((get): TransactionFlowExecutionStatus => {
      const workflow = get(workflowAtom);
      const state = get(stateAtom);
      if (AsyncResult.isFailure(workflow) || AsyncResult.isFailure(state)) {
        return "Failed";
      }
      return AsyncResult.isInitial(workflow) ? "Starting" : "Running";
    }).pipe(Atom.withLabel(`${label}Status`)),
    stateAtom,
    workflowAtom,
  } as const;
};
