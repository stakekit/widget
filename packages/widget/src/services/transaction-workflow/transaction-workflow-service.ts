import {
  Context,
  Effect,
  Layer,
  PubSub,
  Queue,
  type Scope,
  type Stream,
  SubscriptionRef,
} from "effect";
import { WidgetDomainEvents } from "../events/widget-domain-events";
import { walletScopeOwnerKey } from "../wallet/wallet-scope";
import {
  getTransactionWorkflowAction,
  initializeTransactionWorkflow,
  validateTransactionWorkflowInput,
} from "./internal/model";
import { makeTransactionWorkflowProcessor } from "./internal/processor";
import type {
  TransactionWorkflowAction,
  TransactionWorkflowCommand,
  TransactionWorkflowInput,
  TransactionWorkflowInputError,
  TransactionWorkflowState,
} from "./transaction-workflow-model";

export type TransactionWorkflowHandle = {
  readonly dispatch: (
    command: TransactionWorkflowCommand
  ) => Effect.Effect<void>;
  readonly states: Stream.Stream<TransactionWorkflowState>;
};

export class TransactionWorkflowService extends Context.Service<TransactionWorkflowService>()(
  "stakekit/widget/workflow/TransactionWorkflowService",
  {
    make: Effect.gen(function* () {
      const process = yield* makeTransactionWorkflowProcessor;
      const events = yield* WidgetDomainEvents;

      const make = Effect.fn("TransactionWorkflowService.make")(function* (
        input: TransactionWorkflowInput
      ): Effect.fn.Return<
        TransactionWorkflowHandle,
        TransactionWorkflowInputError,
        Scope.Scope
      > {
        const inputError = validateTransactionWorkflowInput(input);
        if (inputError) return yield* inputError;

        const queue = yield* Queue.dropping<TransactionWorkflowAction>(16);
        const stateRef = yield* SubscriptionRef.make(
          initializeTransactionWorkflow(input)
        );
        yield* Effect.addFinalizer(() =>
          Effect.all(
            [Queue.shutdown(queue), PubSub.shutdown(stateRef.pubsub)],
            {
              concurrency: "unbounded",
              discard: true,
            }
          )
        );

        yield* process({
          input,
          queue,
          stateRef,
        }).pipe(Effect.forkScoped);

        const owner = walletScopeOwnerKey(input.walletScope);
        yield* Effect.addFinalizer(() =>
          events.publish({
            _tag: "TransactionWorkflowEnded",
            owner,
            workflowKind: input._tag,
          })
        ).pipe(
          Effect.andThen(
            events.publish({
              _tag: "TransactionWorkflowStarted",
              owner,
            })
          ),
          Effect.uninterruptible
        );

        return {
          dispatch: (command) =>
            SubscriptionRef.get(stateRef).pipe(
              Effect.flatMap((state) => {
                const action = getTransactionWorkflowAction({ command, state });

                return action ? Queue.offer(queue, action) : Effect.void;
              }),
              Effect.asVoid
            ),
          states: SubscriptionRef.changes(stateRef),
        };
      });

      return { make };
    }),
  }
) {
  static readonly layer = Layer.effect(
    TransactionWorkflowService,
    TransactionWorkflowService.make
  );
}
