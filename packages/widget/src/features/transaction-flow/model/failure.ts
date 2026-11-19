import { Schema } from "effect";

/**
 * Why a flow left its Execution for the page it came from: carried in that
 * page's navigation state, so the page says what happened.
 */
export const TransactionFlowFailureState = Schema.Struct({
  transactionFlowFailure: Schema.Literal("ExecutionUnavailable"),
});

export const executionUnavailableState: typeof TransactionFlowFailureState.Type =
  { transactionFlowFailure: "ExecutionUnavailable" };
