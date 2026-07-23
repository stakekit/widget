import { Cause, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";
import { mapAsyncResultError } from "../../src/shared/effect/async-result";

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
