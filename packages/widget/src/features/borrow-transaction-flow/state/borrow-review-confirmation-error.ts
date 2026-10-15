import { Cause, Data, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";

export class BorrowReviewConfirmationError extends Data.TaggedError(
  "BorrowReviewConfirmationError"
)<{ readonly cause: unknown }> {}

/** What the Review page shows of its confirm command. */
export type BorrowReviewConfirmation = {
  readonly pending: boolean;
  /** Why the last settled confirmation failed; typed failures are normalized. */
  readonly failure: Option.Option<Cause.Cause<BorrowReviewConfirmationError>>;
};

export const toBorrowReviewConfirmation = <A, E>(
  result: AsyncResult.AsyncResult<A, E>
): BorrowReviewConfirmation => ({
  failure:
    AsyncResult.isFailure(result) && !result.waiting
      ? Option.some(
          Cause.map(
            result.cause,
            (cause) => new BorrowReviewConfirmationError({ cause })
          )
        )
      : Option.none(),
  pending: result.waiting,
});
