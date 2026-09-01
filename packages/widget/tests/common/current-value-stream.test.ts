import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Fiber, Stream } from "effect";
import { makeCurrentValueStream } from "../../src/shared/effect/current-value-stream";

describe("current value stream", () => {
  it.effect(
    "seeds the current snapshot including updates made before subscription",
    () =>
      Effect.gen(function* () {
        const source = makeCurrentValueStream(0);
        source.set(1);

        const values = yield* source.changes.pipe(
          Stream.take(1),
          Stream.runCollect
        );

        expect(Array.from(values)).toEqual([1]);
      })
  );

  it.effect("publishes updates in order and finalizes the listener", () =>
    Effect.gen(function* () {
      const source = makeCurrentValueStream(0);
      const valuesFiber = yield* Effect.forkChild(
        source.changes.pipe(Stream.take(3), Stream.runCollect)
      );

      yield* Effect.promise(() =>
        vi.waitFor(() => {
          expect(source.subscriberCount()).toBe(1);
        })
      );
      source.set(1);
      source.set(2);

      expect(Array.from(yield* Fiber.join(valuesFiber))).toEqual([0, 1, 2]);
      expect(source.subscriberCount()).toBe(0);
    })
  );

  it.effect("publishes independently to multiple consumers", () =>
    Effect.gen(function* () {
      const source = makeCurrentValueStream("initial");
      const firstFiber = yield* Effect.forkChild(
        source.changes.pipe(Stream.take(2), Stream.runCollect)
      );
      const secondFiber = yield* Effect.forkChild(
        source.changes.pipe(Stream.take(2), Stream.runCollect)
      );

      yield* Effect.promise(() =>
        vi.waitFor(() => {
          expect(source.subscriberCount()).toBe(2);
        })
      );
      source.set("updated");

      expect(Array.from(yield* Fiber.join(firstFiber))).toEqual([
        "initial",
        "updated",
      ]);
      expect(Array.from(yield* Fiber.join(secondFiber))).toEqual([
        "initial",
        "updated",
      ]);
      expect(source.subscriberCount()).toBe(0);
    })
  );
});
