import { Cause, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";
import {
  mapAsyncResultError,
  toPresentable,
} from "../../src/shared/effect/async-result";

describe("mapAsyncResultError", () => {
  const previous = AsyncResult.success<number, string>(1, {
    timestamp: 123,
  });
  const result = AsyncResult.failure<number, string>(Cause.fail("offline"), {
    previousSuccess: Option.some(previous),
    waiting: true,
  });

  const expectMapped = (mapped: AsyncResult.AsyncResult<number, string>) => {
    expect(AsyncResult.isFailure(mapped)).toBe(true);
    if (!AsyncResult.isFailure(mapped)) throw new Error("Expected failure");

    expect(Cause.findErrorOption(mapped.cause)).toEqual(Option.some("OFFLINE"));
    expect(mapped.pipe(AsyncResult.value, Option.getOrThrow)).toBe(1);
    expect(mapped.waiting).toBe(true);
  };

  it("maps typed Cause failures data-first", () => {
    expectMapped(mapAsyncResultError(result, (error) => error.toUpperCase()));
  });

  it("maps typed Cause failures data-last in a pipe", () => {
    expectMapped(
      result.pipe(mapAsyncResultError((error) => error.toUpperCase()))
    );
  });
});

describe("toPresentable", () => {
  const offline = Cause.fail("offline");
  const previous = AsyncResult.success<number, string>(1);

  it.each([
    ["not started", AsyncResult.initial<number, string>()],
    ["fetching the first value", AsyncResult.initial<number, string>(true)],
    [
      "retrying a failure that never had a value",
      AsyncResult.failure<number, string>(offline, { waiting: true }),
    ],
  ])("is Loading while %s", (_, result) => {
    expect(toPresentable(result)).toEqual({ _tag: "Loading" });
  });

  it("is Failed when the read failed and there is nothing to show", () => {
    expect(toPresentable(AsyncResult.failure<number, string>(offline))).toEqual(
      { _tag: "Failed", cause: offline }
    );
  });

  it.each([
    ["settled", AsyncResult.success<number, string>(1), false],
    [
      "revalidating in the background",
      AsyncResult.success<number, string>(1, { waiting: true }),
      true,
    ],
  ])("is Ready with the value when %s", (_, result, refreshing) => {
    expect(toPresentable(result)).toEqual({
      _tag: "Ready",
      refreshFailure: Option.none(),
      refreshing,
      value: 1,
    });
  });

  it("keeps the previous value when a background refetch fails", () => {
    expect(
      toPresentable(
        AsyncResult.failure<number, string>(offline, {
          previousSuccess: Option.some(previous),
        })
      )
    ).toEqual({
      _tag: "Ready",
      refreshFailure: Option.some(offline),
      refreshing: false,
      value: 1,
    });
  });

  it("keeps the previous value while retrying after a failed refetch", () => {
    expect(
      toPresentable(
        AsyncResult.failure<number, string>(offline, {
          previousSuccess: Option.some(previous),
          waiting: true,
        })
      )
    ).toEqual({
      _tag: "Ready",
      refreshFailure: Option.some(offline),
      refreshing: true,
      value: 1,
    });
  });
});

// Pins patches/effect@4.0.3.patch: upstream `all` returned the failing input
// unchanged, so its previous value had that input's shape.
describe("AsyncResult.all after a failed refetch", () => {
  const offline = Cause.fail("offline");
  const failedRefetch = AsyncResult.failure<number, string>(offline, {
    previousSuccess: Option.some(AsyncResult.success<number, string>(1)),
  });

  it("keeps every input's previous value in the combined shape", () => {
    expect(
      toPresentable(
        AsyncResult.all({
          left: failedRefetch,
          right: AsyncResult.success<string, string>("b"),
        })
      )
    ).toEqual({
      _tag: "Ready",
      refreshFailure: Option.some(offline),
      refreshing: false,
      value: { left: 1, right: "b" },
    });
  });

  it("lets map transform the combined previous value", () => {
    const mapped = AsyncResult.all({
      left: failedRefetch,
      right: AsyncResult.success<string, string>("b"),
    }).pipe(AsyncResult.map(({ left, right }) => `${left}${right}`));

    expect(AsyncResult.value(mapped)).toEqual(Option.some("1b"));
  });

  it("drops the previous value when another input has none", () => {
    expect(
      toPresentable(
        AsyncResult.all({
          left: failedRefetch,
          right: AsyncResult.initial<string, string>(),
        })
      )
    ).toEqual({ _tag: "Failed", cause: offline });
  });
});
