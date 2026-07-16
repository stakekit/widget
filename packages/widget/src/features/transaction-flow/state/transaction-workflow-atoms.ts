import { Effect, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime";
import { WalletService } from "../../../services/wallet/wallet-service";
import type {
  ClassicTransactionWorkflowKey,
  TransactionWorkflowCommand,
  TransactionWorkflowKey,
} from "../../../services/workflow/transaction-workflow-model";
import { getTransactionWorkflowId } from "../../../services/workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../../services/workflow/transaction-workflow-service";
import { config } from "../../../shared/config/widget-defaults";
import { refreshAtomResources } from "../../../shared/effect/api-resource";
import {
  tokenBalancesScanResourceAtom,
  yieldBalancesScanResourceAtom,
} from "../../portfolio";
import type { NormalizedWalletState } from "../../wallet";
import {
  actionHistoryTimestampAtom,
  markActionHistoryChanged,
} from "./action-history";

export const getClassicWorkflowCompletionResources = (
  state: NormalizedWalletState
): ReadonlyArray<Atom.Atom<unknown>> => {
  if (state.status !== "connected") return [];

  return [tokenBalancesScanResourceAtom, yieldBalancesScanResourceAtom];
};

export const transactionWorkflowMachineAtom = Atom.family(
  (workflowKey: TransactionWorkflowKey) => {
    const workflowId = getTransactionWorkflowId(workflowKey);

    return appRuntime
      .atom(
        TransactionWorkflowService.use((service) => service.make(workflowKey))
      )
      .pipe(
        Atom.setIdleTTL(config.atomResources.defaultIdleTTL),
        Atom.withLabel(`transactionWorkflow(${workflowId})`)
      );
  }
);

export const transactionWorkflowStateAtom = Atom.family(
  (workflowKey: TransactionWorkflowKey) => {
    const machineAtom = transactionWorkflowMachineAtom(workflowKey);
    const workflowId = getTransactionWorkflowId(workflowKey);

    return appRuntime
      .atom((context) =>
        context.result(machineAtom).pipe(
          Effect.map((machine) => machine.states),
          Stream.unwrap
        )
      )
      .pipe(
        Atom.setIdleTTL(config.atomResources.defaultIdleTTL),
        Atom.withLabel(`transactionWorkflowState(${workflowId})`)
      );
  }
);

export const classicTransactionWorkflowCompletionAtom = Atom.family(
  (workflowKey: ClassicTransactionWorkflowKey) => {
    const machineAtom = transactionWorkflowMachineAtom(workflowKey);
    const workflowId = getTransactionWorkflowId(workflowKey);

    return appRuntime
      .atom(
        (context) =>
          Effect.gen(function* () {
            const [machine, wallet] = yield* Effect.all([
              context.result(machineAtom),
              WalletService,
            ]);

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
                  refreshAtomResources(
                    context,
                    getClassicWorkflowCompletionResources(wallet.getState())
                  );
                })
              ),
              Stream.map(() => undefined)
            );
          }).pipe(Stream.unwrap),
        { initialValue: undefined }
      )
      .pipe(
        Atom.setIdleTTL(config.atomResources.defaultIdleTTL),
        Atom.withLabel(`transactionWorkflowCompletion(${workflowId})`)
      );
  }
);

export const transactionWorkflowDispatchAtom = Atom.family(
  (workflowKey: TransactionWorkflowKey) => {
    const machineAtom = transactionWorkflowMachineAtom(workflowKey);

    return appRuntime.fn(
      (command: TransactionWorkflowCommand, context) =>
        context
          .result(machineAtom)
          .pipe(Effect.flatMap((machine) => machine.dispatch(command))),
      { concurrent: false }
    );
  }
);
