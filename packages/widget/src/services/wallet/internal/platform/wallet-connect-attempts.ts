import {
  Cause,
  Effect,
  Exit,
  Fiber,
  FiberHandle,
  Scope,
  Semaphore,
} from "effect";

/**
 * Runs `operation` as the latest operation in `handle`: a later run
 * interrupts it and closing the handle's scope cancels it. A caller whose
 * operation ended by interruption alone fails with `superseded()`.
 */
export const runLatest = <A, E, S>(
  handle: FiberHandle.FiberHandle,
  operation: Effect.Effect<A, E>,
  superseded: () => S
): Effect.Effect<A, E | S> =>
  Effect.uninterruptibleMask((restore) =>
    FiberHandle.run(handle, operation, { startImmediately: false }).pipe(
      Effect.flatMap((fiber) =>
        restore(Fiber.await(fiber)).pipe(
          Effect.onInterrupt(() => Fiber.interrupt(fiber))
        )
      ),
      Effect.flatMap(
        (exit): Effect.Effect<A, E | S> =>
          Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)
            ? Effect.fail(superseded())
            : exit
      )
    )
  );

/**
 * The connect attempts of one WalletConnect wallet adapter. The latest attempt
 * runs as a fiber in a handle owned by the adapter: a new attempt, `interrupt`
 * or `close` interrupts the pending one and waits for its finalizers, so a
 * superseded attempt never selects a session. Sessions approved after their
 * attempt ended stay with the protocol, which hands them to the next connect.
 */
export type WalletConnectAttempts<S> = Readonly<{
  /**
   * Runs `attempt` as the latest connect. Superseded callers, and callers after
   * `close`, fail with the adapter's `superseded` error.
   */
  run: <A, E>(attempt: Effect.Effect<A, E>) => Effect.Effect<A, E | S>;
  /** Interrupts the pending attempt, if any, and waits for it to end. */
  interrupt: Effect.Effect<void>;
  /** Interrupts the pending attempt and refuses later ones. */
  close: Effect.Effect<void>;
  isClosed: () => boolean;
}>;

export const makeWalletConnectAttempts = <S>(
  superseded: () => S
): WalletConnectAttempts<S> => {
  const scope = Scope.makeUnsafe();
  // Adapters are built synchronously, so the handle is made on first use, in
  // the adapter's scope; the lock keeps concurrent first uses to one handle.
  const lock = Semaphore.makeUnsafe(1);
  let handle: FiberHandle.FiberHandle | undefined;
  const ensureHandle = lock.withPermit(
    Effect.suspend(() => {
      if (handle !== undefined) return Effect.succeed(handle);
      return FiberHandle.make().pipe(
        Scope.provide(scope),
        Effect.tap((made) =>
          Effect.sync(() => {
            handle = made;
          })
        )
      );
    })
  );
  const isClosed = () => scope.state._tag === "Closed";
  const interrupt = Effect.suspend(() =>
    handle === undefined ? Effect.void : FiberHandle.clear(handle)
  );
  const admit = Effect.suspend(() =>
    isClosed() ? Effect.fail(superseded()) : ensureHandle
  );

  return {
    run: (attempt) =>
      interrupt.pipe(
        Effect.andThen(admit),
        Effect.flatMap((current) => runLatest(current, attempt, superseded))
      ),
    interrupt,
    close: Scope.close(scope, Exit.void),
    isClosed,
  };
};
