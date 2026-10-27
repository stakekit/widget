import { Effect, Match } from "effect";
import type { TransactionWorkflowId } from "../../../domain/identity/identifiers";
import type { YieldActionMeta } from "../../wallet/wallet-transactions";
import {
  getCurrentTransactionWorkflowBatch,
  type TransactionWorkflowContext,
  TransactionWorkflowInvariantError,
  type TransactionWorkflowTransactionFor,
} from "../transaction-workflow-model";
import {
  getCurrentTransactionWorkflowTransactionFor,
  getTransactionWorkflowId,
} from "./model";

type CurrentBatch = NonNullable<
  ReturnType<typeof getCurrentTransactionWorkflowBatch>
>;

/** A current transaction exists only once a Yield action is prepared. */
type PreparedYieldDomain = Extract<
  TransactionWorkflowContext["domain"],
  { readonly _tag: "Yield" }
> & { readonly actionMeta: YieldActionMeta };

type CurrentWorkflow =
  | {
      readonly _tag: "Yield";
      readonly batch: CurrentBatch;
      readonly domain: PreparedYieldDomain;
      readonly transaction: TransactionWorkflowTransactionFor<"Yield">;
      readonly workflowId: TransactionWorkflowId;
    }
  | {
      readonly _tag: "Direct";
      readonly batch: CurrentBatch;
      readonly domain: PreparedYieldDomain;
      readonly transaction: TransactionWorkflowTransactionFor<"Direct">;
      readonly workflowId: TransactionWorkflowId;
    }
  | {
      readonly _tag: "Borrow";
      readonly batch: CurrentBatch;
      readonly domain: Extract<
        TransactionWorkflowContext["domain"],
        { readonly _tag: "Borrow" }
      >;
      readonly transaction: TransactionWorkflowTransactionFor<"Borrow">;
      readonly workflowId: TransactionWorkflowId;
    };

export const getCurrentWorkflowTrackingYieldId = (
  current: CurrentWorkflow
): string =>
  current._tag === "Borrow"
    ? current.domain.action.integrationId
    : current.domain.yieldId;

export const requireCurrentWorkflow = Effect.fn(
  "TransactionWorkflow.requireCurrent"
)(function* (context: TransactionWorkflowContext) {
  const batch = getCurrentTransactionWorkflowBatch(context);
  const workflowId = getTransactionWorkflowId(context.domain);
  const missingCurrent = () =>
    Effect.die(
      new TransactionWorkflowInvariantError({
        message: "The transaction workflow has no current transaction.",
        workflowId,
      })
    );

  return yield* Match.value(context.domain).pipe(
    Match.tag("Yield", (domain) => {
      const { actionMeta } = domain;
      if (!batch || !actionMeta) return missingCurrent();
      const prepared = { ...domain, actionMeta };
      const yieldTransaction = getCurrentTransactionWorkflowTransactionFor(
        context,
        "Yield"
      );
      const direct = getCurrentTransactionWorkflowTransactionFor(
        context,
        "Direct"
      );

      if (yieldTransaction) {
        return Effect.succeed({
          _tag: "Yield" as const,
          batch,
          domain: prepared,
          transaction: yieldTransaction,
          workflowId,
        });
      }
      return direct
        ? Effect.succeed({
            _tag: "Direct" as const,
            batch,
            domain: prepared,
            transaction: direct,
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
