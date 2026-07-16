import { Effect, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime";
import { WalletService } from "../../../services/wallet/wallet-service";
import type {
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

export const getTransactionWorkflowAtoms = Atom.family(
  (workflowKey: TransactionWorkflowKey) => {
    const workflowId = getTransactionWorkflowId(workflowKey);
    const machineAtom = appRuntime
      .atom(
        TransactionWorkflowService.use((service) => service.make(workflowKey))
      )
      .pipe(
        Atom.setIdleTTL(config.atomResources.defaultIdleTTL),
        Atom.withLabel(`transactionWorkflow(${workflowId})`)
      );
    const stateAtom = appRuntime
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
    const eventsAtom = appRuntime
      .atom((context) =>
        context.result(machineAtom).pipe(
          Effect.map((machine) => machine.events),
          Stream.unwrap
        )
      )
      .pipe(
        Atom.setIdleTTL(config.atomResources.defaultIdleTTL),
        Atom.withLabel(`transactionWorkflowEvents(${workflowId})`)
      );
    const classicCompletionAtom = appRuntime
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
    const dispatchAtom = appRuntime.fn(
      (command: TransactionWorkflowCommand, context) =>
        context
          .result(machineAtom)
          .pipe(Effect.flatMap((machine) => machine.dispatch(command))),
      { concurrent: false }
    );

    return {
      classicCompletionAtom,
      dispatchAtom,
      eventsAtom,
      machineAtom,
      stateAtom,
    } as const;
  }
);
