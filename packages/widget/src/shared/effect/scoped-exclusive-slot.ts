import { Effect, type Option, type Scope, Semaphore } from "effect";
import { acquireInChildScope } from "./child-scope";

export type ScopedExclusiveSlot = Readonly<{
  /**
   * Acquires `acquire` in a child of the slot's owner Scope, as
   * `acquireInChildScope` does, and holds the slot for that child's lifetime.
   * While another holder is live it answers `None` at once without running
   * `acquire`.
   */
  readonly acquire: <A, E, R>(
    acquire: Effect.Effect<A, E, R>
  ) => Effect.Effect<
    Option.Option<A>,
    E,
    Exclude<R, Scope.Scope> | Scope.Scope
  >;
}>;

/**
 * Makes a slot that at most one holder occupies. Holders live in children of
 * the caller's Scope, so closing it ends the holder and frees the slot.
 */
export const makeScopedExclusiveSlot = Effect.fn("makeScopedExclusiveSlot")(
  function* (): Effect.fn.Return<ScopedExclusiveSlot, never, Scope.Scope> {
    const owner = yield* Effect.scope;
    const semaphore = yield* Semaphore.make(1);
    const hold = Effect.acquireRelease(semaphore.takeIfAvailable(1), (held) =>
      held ? semaphore.release(1) : Effect.void
    );

    return {
      acquire: (acquire) =>
        acquireInChildScope(
          owner,
          Effect.flatMap(hold, (held) =>
            held ? Effect.asSome(acquire) : Effect.succeedNone
          )
        ),
    };
  }
);
