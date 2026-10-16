import { Cause, Option, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type { WidgetNavigationError } from "../../../services/navigation/widget-navigation";
import type { BorrowActionCreationError } from "./orchestration/borrow-flow-review";

/** Why the last Review confirmation failed, as the Review page explains it. */
export const BorrowReviewConfirmationFailure = Schema.TaggedUnion({
  /** The API refused the action; its reason arrives in English only. */
  Rejected: { reason: Schema.String },
  /** The action could not be prepared for any other reason. */
  Failed: {},
});
export type BorrowReviewConfirmationFailure =
  typeof BorrowReviewConfirmationFailure.Type;

const failed = BorrowReviewConfirmationFailure.cases.Failed.make({});

export const toBorrowReviewConfirmationFailure = (
  error: BorrowActionCreationError | WidgetNavigationError
): BorrowReviewConfirmationFailure =>
  error._tag === "BorrowActionRejected"
    ? BorrowReviewConfirmationFailure.cases.Rejected.make({
        reason: error.reason,
      })
    : failed;

/** What the Review page shows of its confirm command. */
export type BorrowReviewConfirmation = {
  readonly pending: boolean;
  readonly failure: Option.Option<BorrowReviewConfirmationFailure>;
};

/**
 * The runtime running the confirm command can fail it with its own errors;
 * only a refusal the API explained is presented as such.
 */
export const toBorrowReviewConfirmation = <A, E>(
  result: AsyncResult.AsyncResult<A, BorrowReviewConfirmationFailure | E>
): BorrowReviewConfirmation => ({
  failure:
    AsyncResult.isFailure(result) && !result.waiting
      ? Option.some(
          Cause.findErrorOption(result.cause).pipe(
            Option.filter(BorrowReviewConfirmationFailure.guards.Rejected),
            Option.getOrElse((): BorrowReviewConfirmationFailure => failed)
          )
        )
      : Option.none(),
  pending: result.waiting,
});
