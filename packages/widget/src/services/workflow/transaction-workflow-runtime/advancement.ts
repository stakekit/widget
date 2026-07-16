import { Effect, Match } from "effect";
import type { Action as BorrowAction } from "../../../domain/borrow";
import {
  appendTransactionWorkflowBatch,
  getCurrentTransactionWorkflowBatch,
  isTerminalBorrowActionStatus,
  makeBorrowTransactionWorkflowBatch,
  TransactionAdvanceError,
  type TransactionWorkflowContext,
} from "../transaction-workflow-model";
import { TransactionWorkflowOperationsService } from "../transaction-workflow-operations-service";

type AdvanceResult =
  | {
      readonly _tag: "Complete";
      readonly context: TransactionWorkflowContext;
    }
  | {
      readonly _tag: "Continue";
      readonly batchId: string;
      readonly context: TransactionWorkflowContext;
    };

type BorrowAdvanceResolution =
  | {
      readonly _tag: "Complete";
      readonly action: BorrowAction;
    }
  | {
      readonly _tag: "NextBatch";
      readonly action: BorrowAction;
    };

const resolveBorrowAdvance = Effect.fn(
  "TransactionWorkflow.resolveBorrowAdvance"
)(function* ({
  batchId,
  previousAction,
  reconcile,
  workflowId,
}: {
  readonly batchId: string;
  readonly previousAction: BorrowAction;
  readonly reconcile: boolean;
  readonly workflowId: string;
}): Effect.fn.Return<
  BorrowAdvanceResolution,
  TransactionAdvanceError,
  TransactionWorkflowOperationsService
> {
  const operations = yield* TransactionWorkflowOperationsService;
  const fail = (message: string, cause?: unknown) =>
    new TransactionAdvanceError({
      batchId,
      cause,
      message,
      transactionId: null,
      workflowId,
    });
  const classifySteppedAction = (action: BorrowAction) => {
    if (isTerminalBorrowActionStatus(action.status)) {
      return Effect.fail(
        fail(`Borrow action ended with ${action.status} status.`)
      );
    }

    return Effect.succeed(
      action.status === "SUCCESS"
        ? ({ _tag: "Complete", action } as const)
        : ({ _tag: "NextBatch", action } as const)
    );
  };
  const step = () =>
    operations.stepBorrowAction(previousAction.id).pipe(
      Effect.mapError((cause) =>
        fail("Borrow action could not advance to the next step.", cause)
      ),
      Effect.flatMap(classifySteppedAction)
    );

  if (!reconcile) {
    return yield* step();
  }

  const reconciled = yield* operations
    .getBorrowAction(previousAction.id)
    .pipe(
      Effect.mapError((cause) =>
        fail("Borrow action status could not be reconciled.", cause)
      )
    );

  if (!reconciled) {
    return yield* step();
  }

  if (isTerminalBorrowActionStatus(reconciled.status)) {
    return yield* fail(`Borrow action ended with ${reconciled.status} status.`);
  }

  if (reconciled.status === "SUCCESS") {
    return { _tag: "Complete", action: reconciled };
  }

  if (reconciled.currentStep > previousAction.currentStep) {
    return { _tag: "NextBatch", action: reconciled };
  }

  if (
    reconciled.currentStep === previousAction.currentStep &&
    !reconciled.hasNextStep
  ) {
    return { _tag: "Complete", action: reconciled };
  }

  return yield* step();
});

export const advanceBatch = Effect.fn("TransactionWorkflow.advanceBatch")(
  function* ({
    context,
    reconcile,
  }: {
    readonly context: TransactionWorkflowContext;
    readonly reconcile: boolean;
  }): Effect.fn.Return<
    AdvanceResult,
    TransactionAdvanceError,
    TransactionWorkflowOperationsService
  > {
    const batch = getCurrentTransactionWorkflowBatch(context);
    const workflowId =
      context.domain._tag === "Classic"
        ? context.domain.actionMeta.actionId
        : context.domain.action.id;
    const fail = (message: string, cause?: unknown) =>
      new TransactionAdvanceError({
        batchId: batch?.id ?? "unknown",
        cause,
        message,
        transactionId: null,
        workflowId,
      });

    if (context.domain._tag === "Classic") {
      return { _tag: "Complete", context };
    }

    const previousAction = context.domain.action;

    if (previousAction.status === "SUCCESS" || !previousAction.hasNextStep) {
      return { _tag: "Complete", context };
    }

    const resolution = yield* resolveBorrowAdvance({
      batchId: batch?.id ?? "unknown",
      previousAction,
      reconcile,
      workflowId,
    });

    return yield* Match.value(resolution).pipe(
      Match.tag("Complete", ({ action }) =>
        Effect.succeed({
          _tag: "Complete" as const,
          context: {
            ...context,
            domain: { _tag: "Borrow" as const, action },
          },
        })
      ),
      Match.tag("NextBatch", ({ action }) => {
        const domain = { _tag: "Borrow" as const, action };
        const nextBatch = makeBorrowTransactionWorkflowBatch(action);
        const next = appendTransactionWorkflowBatch({
          batch: nextBatch,
          context,
          domain,
        });

        return next.currentTransactionIndex === null &&
          action.hasNextStep &&
          nextBatch.id === batch?.id
          ? Effect.fail(fail("Borrow action returned the same completed step."))
          : Effect.succeed({
              _tag: "Continue" as const,
              batchId: nextBatch.id,
              context: next,
            });
      }),
      Match.exhaustive
    );
  }
);
