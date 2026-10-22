import { Effect } from "effect";
import {
  decideErc20Approval,
  makeErc20Approval,
} from "../../../domain/action/direct-transaction";
import { EvmRpc } from "../../evm-rpc/evm-rpc";
import {
  makeTransactionSignError,
  type TransactionWorkflowContext,
} from "../transaction-workflow-model";
import {
  getCurrentTransactionWorkflowTransactionFor,
  getTransactionWorkflowId,
  insertBeforeCurrentTransactionWorkflowTransaction,
  skipCurrentTransactionWorkflowTransaction,
} from "./model";

/**
 * Reads the allowance a Direct approval serves again before it is signed: an
 * approval may have landed since it was planned, and USDT reverts when one
 * non-zero allowance changes to another. An approval nothing needs is
 * skipped; one that finds a short allowance resets it first.
 */
export const makeCheckApproval = Effect.gen(function* () {
  const evmRpc = yield* EvmRpc;

  return Effect.fn("TransactionWorkflow.checkApproval")(function* (
    context: TransactionWorkflowContext
  ) {
    const direct = getCurrentTransactionWorkflowTransactionFor(
      context,
      "Direct"
    )?.source.transaction;
    const approval = direct?.approval;
    if (!direct || !approval) return { _tag: "Sign" } as const;

    const allowance = yield* evmRpc
      .readAllowance({ chainId: direct.chainId, ...approval })
      .pipe(
        Effect.mapError((cause) =>
          makeTransactionSignError({
            batchId: context.batches[context.currentBatchIndex ?? 0]?.id ?? "",
            network: direct.network,
            reason: { _tag: "EstimateFailed", cause },
            transactionId: direct.id,
            workflowId: getTransactionWorkflowId(context.domain),
          })
        )
      );

    switch (decideErc20Approval({ ...direct, approval }, allowance)) {
      case "Sign":
        return { _tag: "Sign" } as const;
      case "Skip":
        return {
          _tag: "Continue",
          context: skipCurrentTransactionWorkflowTransaction(context),
        } as const;
      case "ResetFirst":
        return {
          _tag: "Continue",
          context: insertBeforeCurrentTransactionWorkflowTransaction(
            context,
            makeErc20Approval({
              ...approval,
              chainId: direct.chainId,
              id: direct.id,
              network: direct.network,
              type: "RESET_APPROVAL",
            })
          ),
        } as const;
    }
  });
});
