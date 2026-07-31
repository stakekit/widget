import { type Cause, Effect, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { walletRuntime } from "../../app/runtime/wallet-runtime";
import type { WalletBootstrapError } from "../../services/wallet/bootstrap";
import {
  getTransactionWorkflowId,
  type TransactionWorkflowCommand,
  type TransactionWorkflowInput,
  type TransactionWorkflowInputError,
  type TransactionWorkflowState,
} from "../../services/workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../services/workflow/transaction-workflow-service";

export type TransactionWorkflowLoadingError =
  | Cause.NoSuchElementError
  | TransactionWorkflowInputError
  | WalletBootstrapError;

/** Owns one fresh workflow machine for one execution attempt. */
export const makeTransactionWorkflowModule = <
  Input extends TransactionWorkflowInput,
>(
  input: Input
) => {
  const workflowId = getTransactionWorkflowId(input);
  const activeAtom = Atom.make(false).pipe(Atom.setIdleTTL(0));
  const publishedStateAtom = Atom.make<
    AsyncResult.AsyncResult<
      TransactionWorkflowState,
      TransactionWorkflowLoadingError
    >
  >(AsyncResult.initial()).pipe(Atom.setIdleTTL(0));

  const machineAtom = walletRuntime
    .atom(TransactionWorkflowService.use((service) => service.make(input)))
    .pipe(
      Atom.setIdleTTL(0),
      Atom.withLabel(`transactionWorkflow(${workflowId})`)
    );
  const machineStateAtom = walletRuntime
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
  const stateAtom = Atom.make((get) => get(publishedStateAtom)).pipe(
    Atom.setIdleTTL(0),
    Atom.withLabel(`transactionWorkflowPublishedState(${workflowId})`)
  );
  const commandAtom = walletRuntime
    .fn(
      (command: TransactionWorkflowCommand, context) =>
        context(activeAtom)
          ? context
              .result(machineAtom)
              .pipe(Effect.flatMap((machine) => machine.dispatch(command)))
          : Effect.void,
      { concurrent: false }
    )
    .pipe(
      Atom.setIdleTTL(0),
      Atom.withLabel(`transactionWorkflowCommand(${workflowId})`)
    );

  const module = {
    commandAtom,
    input,
    stateAtom,
  } as const;

  return Atom.make((context) => {
    const registry = context.registry;
    context.set(activeAtom, true);
    context.mount(activeAtom);
    context.subscribe(
      machineStateAtom,
      (state) => registry.set(publishedStateAtom, state),
      { immediate: true }
    );
    context.addFinalizer(() => {
      registry.set(activeAtom, false);
      registry.set(publishedStateAtom, AsyncResult.initial());
    });

    return module;
  }).pipe(
    Atom.setIdleTTL(0),
    Atom.withLabel(`transactionWorkflowScope(${workflowId})`)
  );
};
