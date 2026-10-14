import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Option, Scope } from "effect";
import { makeScopedExclusiveSlot } from "../../../src/shared/effect/scoped-exclusive-slot";

describe("makeScopedExclusiveSlot", () => {
  it.effect(
    "rejects a second holder until the first holder's Scope closes",
    () =>
      Effect.gen(function* () {
        let acquired = 0;
        const acquire = Effect.sync(() => ++acquired);
        const owner = yield* Scope.make();
        const slot = yield* makeScopedExclusiveSlot().pipe(
          Scope.provide(owner)
        );
        const first = yield* Scope.make();
        const second = yield* Scope.make();

        const held = yield* slot.acquire(acquire).pipe(Scope.provide(first));
        const overlapping = yield* slot
          .acquire(acquire)
          .pipe(Scope.provide(second));
        yield* Scope.close(first, Exit.void);
        const afterRelease = yield* slot
          .acquire(acquire)
          .pipe(Scope.provide(second));

        expect(held).toEqual(Option.some(1));
        expect(overlapping).toEqual(Option.none());
        expect(afterRelease).toEqual(Option.some(2));
      })
  );

  it.effect("frees the slot when its holder fails to acquire", () =>
    Effect.gen(function* () {
      const owner = yield* Scope.make();
      const slot = yield* makeScopedExclusiveSlot().pipe(Scope.provide(owner));
      const consumer = yield* Scope.make();

      const failed = yield* slot
        .acquire(Effect.fail("boom"))
        .pipe(Scope.provide(consumer), Effect.exit);
      const retried = yield* slot
        .acquire(Effect.succeed("held"))
        .pipe(Scope.provide(consumer));

      expect(Exit.isFailure(failed)).toBe(true);
      expect(retried).toEqual(Option.some("held"));
    })
  );

  it.effect("ends the holder when the owner Scope closes", () =>
    Effect.gen(function* () {
      const events: Array<string> = [];
      const owner = yield* Scope.make();
      const slot = yield* makeScopedExclusiveSlot().pipe(Scope.provide(owner));
      const consumer = yield* Scope.make();

      yield* slot
        .acquire(
          Effect.acquireRelease(Effect.void, () =>
            Effect.sync(() => events.push("released"))
          )
        )
        .pipe(Scope.provide(consumer));
      yield* Scope.close(owner, Exit.void);

      expect(events).toEqual(["released"]);
    })
  );
});
