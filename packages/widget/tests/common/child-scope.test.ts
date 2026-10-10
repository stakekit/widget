import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Scope } from "effect";
import { acquireInChildScope } from "../../src/shared/effect/child-scope";

const trackedResource = (events: Array<string>, name: string) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      events.push(`${name}-acquired`);
      return name;
    }),
    () => Effect.sync(() => events.push(`${name}-released`))
  );

describe("acquireInChildScope", () => {
  it.effect("releases the resource when its owner Scope closes first", () =>
    Effect.gen(function* () {
      const events: Array<string> = [];
      const owner = yield* Scope.make();
      const consumer = yield* Scope.make();

      const value = yield* acquireInChildScope(
        owner,
        trackedResource(events, "review")
      ).pipe(Scope.provide(consumer));
      yield* Scope.close(owner, Exit.void);
      const afterOwnerClose = [...events];
      yield* Scope.close(consumer, Exit.void);

      expect(value).toBe("review");
      expect(afterOwnerClose).toEqual(["review-acquired", "review-released"]);
      expect(events).toEqual(["review-acquired", "review-released"]);
    })
  );

  it.effect(
    "releases the resource when its consumer Scope closes while the owner lives",
    () =>
      Effect.gen(function* () {
        const events: Array<string> = [];
        const owner = yield* Scope.make();
        const consumer = yield* Scope.make();

        yield* acquireInChildScope(
          owner,
          trackedResource(events, "execution")
        ).pipe(Scope.provide(consumer));
        yield* Scope.close(consumer, Exit.void);
        const afterConsumerClose = [...events];
        yield* Scope.addFinalizer(
          owner,
          Effect.sync(() => events.push("owner-released"))
        );
        yield* Scope.close(owner, Exit.void);

        expect(afterConsumerClose).toEqual([
          "execution-acquired",
          "execution-released",
        ]);
        expect(events).toEqual([
          "execution-acquired",
          "execution-released",
          "owner-released",
        ]);
      })
  );

  it.effect("does not acquire within an owner Scope that already closed", () =>
    Effect.gen(function* () {
      const events: Array<string> = [];
      const owner = yield* Scope.make();
      yield* Scope.close(owner, Exit.void);

      const exit = yield* acquireInChildScope(
        owner,
        trackedResource(events, "late")
      ).pipe(Effect.scoped, Effect.exit);

      expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
        true
      );
      expect(events).toEqual([]);
    })
  );
});
