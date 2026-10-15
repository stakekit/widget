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
import { walletScopeOwnerKey } from "../../domain/wallet/wallet-scope";
import { WidgetDomainEvents } from "../events/widget-domain-events";
import { makeHeldHashRegistration } from "./internal/held-hash-registration";
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
      const registerHeldHash = yield* makeHeldHashRegistration;
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

        const owner = walletScopeOwnerKey(input.walletScope);

        // Registered before the processor forks, so it runs after the processor
        // is interrupted and reads the state the workflow was left in.
        yield* Effect.addFinalizer(() =>
          SubscriptionRef.get(stateRef).pipe(Effect.flatMap(registerHeldHash))
        );

        yield* process({
          input,
          queue,
          resourcesChanged: events.publish({
            _tag: "TransactionWorkflowResourcesChanged",
            owner,
            workflowKind: input._tag,
          }),
          stateRef,
        }).pipe(Effect.forkScoped);

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
