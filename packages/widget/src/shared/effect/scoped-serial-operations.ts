import { Effect, Fiber, type Scope, Semaphore } from "effect";

type ScopedSerialOperations = Readonly<{
  readonly run: <A, E, R>(
    operation: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>;
}>;

export const makeScopedSerialOperations = Effect.fn(
  "makeScopedSerialOperations"
)(function* (): Effect.fn.Return<ScopedSerialOperations, never, Scope.Scope> {
  const semaphore = yield* Semaphore.make(1);
  const ownerScope = yield* Effect.scope;

  return {
    run: <A, E, R>(operation: Effect.Effect<A, E, R>) =>
      Effect.uninterruptibleMask((restore) =>
        Effect.suspend(() =>
          ownerScope.state._tag === "Closed"
            ? Effect.interrupt
            : operation.pipe(semaphore.withPermits(1))
        ).pipe(
          Effect.forkIn(ownerScope, {
            startImmediately: true,
            uninterruptible: false,
          }),
          Effect.flatMap((fiber) =>
            restore(Fiber.join(fiber)).pipe(
              Effect.onInterrupt(() =>
                Fiber.interrupt(fiber).pipe(Effect.asVoid)
              )
            )
          )
        )
      ),
  };
});
