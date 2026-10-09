import { Effect, Exit, Scope } from "effect";

/**
 * Acquires `acquire` in a child of `owner`. The resource lives until either
 * `owner` or the caller's Scope closes, so a consumer can hold a resource that
 * ends with the lifetime that owns it. Acquiring within a closed `owner` is
 * interrupted without running `acquire`.
 */
export const acquireInChildScope = <A, E, R>(
  owner: Scope.Scope,
  acquire: Effect.Effect<A, E, R>
): Effect.Effect<A, E, Exclude<R, Scope.Scope> | Scope.Scope> =>
  Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      if (owner.state._tag === "Closed") return yield* Effect.interrupt;
      const child = yield* Scope.fork(owner);
      yield* Effect.addFinalizer((exit) => Scope.close(child, exit));
      return yield* restore(acquire.pipe(Scope.provide(child))).pipe(
        Effect.onError((cause) => Scope.close(child, Exit.failCause(cause)))
      );
    })
  );
