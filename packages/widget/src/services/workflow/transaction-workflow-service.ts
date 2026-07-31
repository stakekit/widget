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
import {
  getTransactionWorkflowAction,
  initializeTransactionWorkflow,
  type TransactionWorkflowAction,
  type TransactionWorkflowCommand,
  type TransactionWorkflowInput,
  type TransactionWorkflowInputError,
  type TransactionWorkflowState,
  validateTransactionWorkflowInput,
} from "./transaction-workflow-model";
import { TransactionWorkflowOperationsService } from "./transaction-workflow-operations-service";
import { makeTransactionWorkflowProcessor } from "./transaction-workflow-runtime/processor";

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
      const operations = yield* TransactionWorkflowOperationsService;

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

        yield* makeTransactionWorkflowProcessor({
          input,
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
