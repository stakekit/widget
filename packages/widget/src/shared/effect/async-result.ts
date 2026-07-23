import { Cause, Option } from "effect";
import { dual } from "effect/Function";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

/**
 * AsyncResult has no error-channel mapper. Map the typed failures inside Cause
 * while preserving defects, interruptions, waiting, and the previous success.
 */
export const mapAsyncResultError: {
  <E, E2>(
    mapError: (error: E) => E2
  ): <A>(
    result: AsyncResult.AsyncResult<A, E>
  ) => AsyncResult.AsyncResult<A, E2>;
  <A, E, E2>(
    result: AsyncResult.AsyncResult<A, E>,
    mapError: (error: E) => E2
  ): AsyncResult.AsyncResult<A, E2>;
} = dual(
  2,
  <A, E, E2>(
    result: AsyncResult.AsyncResult<A, E>,
    mapError: (error: E) => E2
  ): AsyncResult.AsyncResult<A, E2> => {
    switch (result._tag) {
      case "Initial":
        return AsyncResult.initial<A, E2>(result.waiting);
      case "Success":
        return AsyncResult.success<A, E2>(result.value, {
          timestamp: result.timestamp,
          waiting: result.waiting,
        });
      case "Failure":
        return AsyncResult.failure(Cause.map(result.cause, mapError), {
          previousSuccess: Option.map(result.previousSuccess, (previous) =>
            AsyncResult.success<A, E2>(previous.value, {
              timestamp: previous.timestamp,
              waiting: previous.waiting,
            })
          ),
          waiting: result.waiting,
        });
    }
  }
);
