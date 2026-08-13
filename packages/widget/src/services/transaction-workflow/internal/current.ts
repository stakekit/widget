import { Effect, Match } from "effect";
import {
  getCurrentTransactionWorkflowBatch,
  type TransactionWorkflowContext,
  TransactionWorkflowInvariantError,
  type TransactionWorkflowTransactionFor,
} from "../transaction-workflow-model";
import { getCurrentTransactionWorkflowTransactionFor } from "./model";

type CurrentBatch = NonNullable<
  ReturnType<typeof getCurrentTransactionWorkflowBatch>
>;

export type CurrentWorkflow =
  | {
      readonly _tag: "Classic";
      readonly batch: CurrentBatch;
      readonly domain: Extract<
        TransactionWorkflowContext["domain"],
        { readonly _tag: "Classic" }
      >;
      readonly transaction: TransactionWorkflowTransactionFor<"Classic">;
      readonly workflowId: string;
    }
  | {
      readonly _tag: "Borrow";
      readonly batch: CurrentBatch;
      readonly domain: Extract<
        TransactionWorkflowContext["domain"],
        { readonly _tag: "Borrow" }
      >;
      readonly transaction: TransactionWorkflowTransactionFor<"Borrow">;
      readonly workflowId: string;
    };

export const requireCurrentWorkflow = Effect.fn(
  "TransactionWorkflow.requireCurrent"
)(function* (context: TransactionWorkflowContext) {
  const batch = getCurrentTransactionWorkflowBatch(context);
  const workflowId = Match.value(context.domain).pipe(
    Match.tag("Classic", ({ actionMeta }) => actionMeta.actionId),
    Match.tag("Borrow", ({ action }) => action.id),
    Match.exhaustive
  );
  const missingCurrent = () =>
    Effect.die(
      new TransactionWorkflowInvariantError({
        message: "The transaction workflow has no current transaction.",
        workflowId,
      })
    );

  return yield* Match.value(context.domain).pipe(
    Match.tag("Classic", (domain) => {
      const transaction = getCurrentTransactionWorkflowTransactionFor(
        context,
        "Classic"
      );

      return batch && transaction
        ? Effect.succeed({
            _tag: "Classic" as const,
            batch,
            domain,
            transaction,
            workflowId,
          })
        : missingCurrent();
    }),
    Match.tag("Borrow", (domain) => {
      const transaction = getCurrentTransactionWorkflowTransactionFor(
        context,
        "Borrow"
      );

      return batch && transaction
        ? Effect.succeed({
            _tag: "Borrow" as const,
            batch,
            domain,
            transaction,
            workflowId,
          })
        : missingCurrent();
    }),
    Match.exhaustive
  ) satisfies Effect.Effect<CurrentWorkflow>;
});
