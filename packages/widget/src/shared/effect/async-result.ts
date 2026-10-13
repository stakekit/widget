import { Cause, Option } from "effect";
import { dual } from "effect/Function";
import * as AsyncResult from "effect/reactivity/AsyncResult";

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

/**
 * What a view can present from a result. A view blocks only while there is
 * nothing to show: once a value exists, revalidation and failed refetches are
 * background facts about that value, never a loader or an error screen.
 */
export type Presentable<A, E> =
  | { readonly _tag: "Loading" }
  | { readonly _tag: "Failed"; readonly cause: Cause.Cause<E> }
  | {
      readonly _tag: "Ready";
      /** Why the latest refetch failed, while `value` is the last success. */
      readonly refreshFailure: Option.Option<Cause.Cause<E>>;
      readonly refreshing: boolean;
      readonly value: A;
    };

export const toPresentable = <A, E>(
  result: AsyncResult.AsyncResult<A, E>
): Presentable<A, E> => {
  const value = AsyncResult.value(result);
  if (Option.isSome(value)) {
    return {
      _tag: "Ready",
      refreshFailure: AsyncResult.isFailure(result)
        ? Option.some(result.cause)
        : Option.none(),
      refreshing: result.waiting,
      value: value.value,
    };
  }
  if (AsyncResult.isFailure(result) && !result.waiting) {
    return { _tag: "Failed", cause: result.cause };
  }
  return { _tag: "Loading" };
};
