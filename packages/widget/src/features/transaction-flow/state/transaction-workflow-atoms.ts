import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import type {
  TransactionWorkflowCommand,
  TransactionWorkflowKey,
} from "../../../services/workflow/transaction-workflow-model";
import {
  getTransactionWorkflowId,
  initializeTransactionWorkflow,
} from "../../../services/workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../../services/workflow/transaction-workflow-service";
import type { ClassicTransactionFlowWorkflowHandoff } from "../model/classic-transaction-flow";
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

export const classicTransactionWorkflowMachineAtom = Atom.family(
  (handoff: ClassicTransactionFlowWorkflowHandoff) => {
    const workflowId = getTransactionWorkflowId(handoff.workflowKey);

    return walletRuntime
      .atom(
        TransactionWorkflowService.use((service) =>
          service.make(handoff.workflowKey)
        )
      )
      .pipe(
        Atom.setIdleTTL(0),
        Atom.withLabel(`classicTransactionWorkflow(${workflowId})`)
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

export const classicTransactionWorkflowStateAtom = Atom.family(
  (handoff: ClassicTransactionFlowWorkflowHandoff) => {
    const machineAtom = classicTransactionWorkflowMachineAtom(handoff);
    const workflowId = getTransactionWorkflowId(handoff.workflowKey);

    return walletRuntime
      .atom((context) =>
        context.result(machineAtom).pipe(
          Effect.map((machine) => machine.states),
          Stream.unwrap
        )
      )
      .pipe(
        Atom.setIdleTTL(0),
        Atom.withLabel(`classicTransactionWorkflowState(${workflowId})`)
      );
  }
);

export const classicTransactionWorkflowViewAtom = Atom.family(
  (handoff: ClassicTransactionFlowWorkflowHandoff) =>
    Atom.make((get) => {
      const result = get(classicTransactionWorkflowStateAtom(handoff));

      return {
        flowIdentity: handoff.flowIdentity,
        result,
        state: Option.getOrElse(AsyncResult.value(result), () =>
          initializeTransactionWorkflow(handoff.workflowKey)
        ),
        workflowKey: handoff.workflowKey,
      } as const;
    }).pipe(Atom.withLabel("classicTransactionWorkflowViewAtom"))
);

export const classicTransactionWorkflowCompletionAtom = Atom.family(
  (handoff: ClassicTransactionFlowWorkflowHandoff) => {
    const machineAtom = classicTransactionWorkflowMachineAtom(handoff);
    const workflowId = getTransactionWorkflowId(handoff.workflowKey);

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

export const classicTransactionWorkflowDispatchAtom = Atom.family(
  (handoff: ClassicTransactionFlowWorkflowHandoff) => {
    const machineAtom = classicTransactionWorkflowMachineAtom(handoff);

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
