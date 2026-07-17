import {
  Context,
  Effect,
  Layer,
  PubSub,
  Queue,
  type Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import {
  getTransactionWorkflowAction,
  initializeTransactionWorkflow,
  type TransactionWorkflowAction,
  type TransactionWorkflowCommand,
  type TransactionWorkflowEvent,
  type TransactionWorkflowKey,
  type TransactionWorkflowState,
} from "./transaction-workflow-model";
import { TransactionWorkflowOperationsService } from "./transaction-workflow-operations-service";
import { makeTransactionWorkflowProcessor } from "./transaction-workflow-runtime/processor";

export type TransactionWorkflowHandle = {
  readonly dispatch: (
    command: TransactionWorkflowCommand
  ) => Effect.Effect<void>;
  readonly events: Stream.Stream<TransactionWorkflowEvent>;
  readonly states: Stream.Stream<TransactionWorkflowState>;
};

export class TransactionWorkflowService extends Context.Service<TransactionWorkflowService>()(
  "stakekit/widget/workflow/TransactionWorkflowService",
  {
    make: Effect.gen(function* () {
      const operations = yield* TransactionWorkflowOperationsService;

      const make = Effect.fn("TransactionWorkflowService.make")(function* (
        key: TransactionWorkflowKey
      ): Effect.fn.Return<TransactionWorkflowHandle, never, Scope.Scope> {
        const queue = yield* Queue.dropping<TransactionWorkflowAction>(16);
        const stateRef = yield* SubscriptionRef.make(
          initializeTransactionWorkflow(key)
        );
        const events = yield* PubSub.sliding<TransactionWorkflowEvent>({
          capacity: 32,
          replay: 8,
        });
        yield* Effect.addFinalizer(() =>
          Effect.all([Queue.shutdown(queue), PubSub.shutdown(events)], {
            concurrency: "unbounded",
            discard: true,
          })
        );

        yield* makeTransactionWorkflowProcessor({
          events,
          key,
          queue,
          stateRef,
        }).pipe(
          Effect.provideService(
            TransactionWorkflowOperationsService,
            operations
          ),
          Effect.forkScoped
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
          events: Stream.fromPubSub(events),
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
