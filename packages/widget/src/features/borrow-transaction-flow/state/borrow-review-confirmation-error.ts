import { Data } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { mapAsyncResultError } from "../../../shared/effect/async-result";

export class BorrowReviewConfirmationError extends Data.TaggedError(
  "BorrowReviewConfirmationError"
)<{ readonly cause: unknown }> {}

export const normalizeBorrowReviewConfirmationResult = <A, E>(
  result: AsyncResult.AsyncResult<A, E>
): AsyncResult.AsyncResult<A, BorrowReviewConfirmationError> =>
  mapAsyncResultError(
    result,
    (cause) => new BorrowReviewConfirmationError({ cause })
  );
