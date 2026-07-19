import { Effect, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import type {
  ClassicTransactionWorkflowKey,
  TransactionWorkflowCommand,
  TransactionWorkflowKey,
} from "../../../services/workflow/transaction-workflow-model";
import { getTransactionWorkflowId } from "../../../services/workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../../services/workflow/transaction-workflow-service";
import {
  actionHistoryTimestampAtom,
  markActionHistoryChanged,
} from "./action-history";

export const transactionWorkflowMachineAtom = Atom.family(
  (workflowKey: TransactionWorkflowKey) => {
    const workflowId = getTransactionWorkflowId(workflowKey);

    return walletRuntime
      .atom(
        TransactionWorkflowService.use((service) => service.make(workflowKey))
      )
      .pipe(
        Atom.setIdleTTL(0),
        Atom.withLabel(`transactionWorkflow(${workflowId})`)
      );
  }
);

export const transactionWorkflowStateAtom = Atom.family(
  (workflowKey: TransactionWorkflowKey) => {
    const machineAtom = transactionWorkflowMachineAtom(workflowKey);
    const workflowId = getTransactionWorkflowId(workflowKey);

    return walletRuntime
      .atom((context) =>
        context.result(machineAtom).pipe(
          Effect.map((machine) => machine.states),
          Stream.unwrap
        )
      )
      .pipe(
        Atom.setIdleTTL(0),
        Atom.withLabel(`transactionWorkflowState(${workflowId})`)
      );
  }
);

export const classicTransactionWorkflowCompletionAtom = Atom.family(
  (workflowKey: ClassicTransactionWorkflowKey) => {
    const machineAtom = transactionWorkflowMachineAtom(workflowKey);
    const workflowId = getTransactionWorkflowId(workflowKey);

    return walletRuntime
      .atom(
        (context) =>
          Effect.gen(function* () {
            const machine = yield* context.result(machineAtom);

            return machine.events.pipe(
              Stream.filter(
                (event) =>
                  event._tag === "TransactionWorkflowCompleted" &&
                  event.context.domain._tag === "Classic"
              ),
              Stream.tap(() =>
                Effect.sync(() => {
                  context.set(
                    actionHistoryTimestampAtom,
                    markActionHistoryChanged()
                  );
                })
              ),
              Stream.map(() => undefined)
            );
          }).pipe(Stream.unwrap),
        { initialValue: undefined }
      )
      .pipe(
        Atom.setIdleTTL(0),
        Atom.withLabel(`transactionWorkflowCompletion(${workflowId})`)
      );
  }
);

export const transactionWorkflowDispatchAtom = Atom.family(
  (workflowKey: TransactionWorkflowKey) => {
    const machineAtom = transactionWorkflowMachineAtom(workflowKey);

    return walletRuntime
      .fn(
        (command: TransactionWorkflowCommand, context) =>
          context
            .result(machineAtom)
            .pipe(Effect.flatMap((machine) => machine.dispatch(command))),
        { concurrent: false }
      )
      .pipe(Atom.setIdleTTL(0));
  }
);
