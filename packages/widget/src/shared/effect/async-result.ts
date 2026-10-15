import { Cause, Option, Predicate } from "effect";
import { dual } from "effect/Function";
import * as AsyncResult from "effect/reactivity/AsyncResult";

type CombinedEntries<Arg> = {
  -readonly [K in keyof Arg]: [Arg[K]] extends [
    AsyncResult.AsyncResult<infer A, infer _E>,
  ]
    ? A
    : Arg[K];
};

/** The value of a combination: each input result replaced by its value. */
type CombinedValue<Arg> = [Arg] extends [ReadonlyArray<unknown>]
  ? CombinedEntries<Arg>
  : [Arg] extends [Iterable<infer Item>]
    ? Array<Item extends AsyncResult.AsyncResult<infer A, infer _E> ? A : Item>
    : CombinedEntries<Arg>;

/** The failure of a combination: any input result's failure. */
type CombinedError<Arg> = [Arg] extends [ReadonlyArray<unknown>]
  ? AsyncResult.AsyncResult.Failure<Arg[number]>
  : [Arg] extends [Iterable<infer Item>]
    ? AsyncResult.AsyncResult.Failure<Item>
    : AsyncResult.AsyncResult.Failure<Arg[keyof Arg]>;

export type CombinedAsyncResult<Arg> = AsyncResult.AsyncResult<
  CombinedValue<Arg>,
  CombinedError<Arg>
>;

/**
 * Combine results into one result over the combined shape. Replaces upstream
 * `AsyncResult.all`, which returns the first failing input unchanged, so its
 * previous success has that input's shape and `map` receives the wrong value.
 * Here a failure carries a previous success rebuilt from every input's value,
 * or none when any input has no value, and keeps its waiting flag.
 */
export const combineAsyncResults = <
  const Arg extends Iterable<unknown> | Record<string, unknown>,
>(
  results: Arg
): CombinedAsyncResult<Arg> => {
  const isIterable = Predicate.isIterable(results);
  const entries: ReadonlyArray<readonly [string | number, unknown]> = isIterable
    ? Array.from(results, (result, index) => [index, result] as const)
    : Object.entries(results);
  const combine = (values: ReadonlyArray<unknown>) =>
    (isIterable
      ? values
      : Object.fromEntries(
          entries.map(([key], index) => [key, values[index]])
        )) as CombinedValue<Arg>;

  const values: Array<unknown> = [];
  let waiting = false;
  for (const [, entry] of entries) {
    if (!AsyncResult.isAsyncResult(entry)) {
      values.push(entry);
      continue;
    }
    if (AsyncResult.isFailure(entry)) {
      return combinedFailure(entries, entry, combine);
    }
    if (!AsyncResult.isSuccess(entry)) {
      return AsyncResult.initial(entry.waiting);
    }
    values.push(entry.value);
    waiting ||= entry.waiting;
  }
  return AsyncResult.success(combine(values), { waiting });
};

const combinedFailure = <A, E>(
  entries: ReadonlyArray<readonly [string | number, unknown]>,
  failure: AsyncResult.Failure<unknown, unknown>,
  combine: (values: ReadonlyArray<unknown>) => A
): AsyncResult.AsyncResult<A, E> => {
  const cause = failure.cause as Cause.Cause<E>;
  const previous: Array<unknown> = [];
  for (const [, entry] of entries) {
    if (!AsyncResult.isAsyncResult(entry)) {
      previous.push(entry);
      continue;
    }
    const entryValue = AsyncResult.value(entry);
    if (Option.isNone(entryValue)) {
      return AsyncResult.failure(cause, { waiting: failure.waiting });
    }
    previous.push(entryValue.value);
  }
  return AsyncResult.failure(cause, {
    previousSuccess: Option.some(AsyncResult.success(combine(previous))),
    waiting: failure.waiting,
  });
};

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
