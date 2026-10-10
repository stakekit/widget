import {
  Context,
  Effect,
  Exit,
  Fiber,
  Layer,
  Ref,
  Scope,
  type Stream,
  SubscriptionRef,
} from "effect";

/**
 * One opening of a modal: from a `set` call until the next one. Work that is
 * only relevant to this opening runs through `run`; ending the opening
 * interrupts it.
 */
export type WalletModalOpening = Readonly<{
  /**
   * Runs `effect` as part of this opening. Ending the opening interrupts it at
   * its next async boundary; once the opening has ended, `effect` never starts.
   */
  readonly run: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>;
  /** Runs `finalizer` when this opening ends, or now if it already has. */
  readonly onEnd: (finalizer: Effect.Effect<unknown>) => Effect.Effect<void>;
}>;

type WalletModalOpenState = Readonly<{
  readonly changes: Stream.Stream<boolean>;
  readonly current: Effect.Effect<boolean>;
  /** The opening in effect now. */
  readonly opening: Effect.Effect<WalletModalOpening>;
  /**
   * Ends the current opening, even when `open` is unchanged, and starts the
   * next. Its work is interrupted without being awaited: that work may itself
   * end the opening, directly or through a fiber it awaits.
   */
  readonly set: (open: boolean) => Effect.Effect<void>;
}>;

const makeOpening = (scope: Scope.Scope): WalletModalOpening => ({
  run: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.uninterruptibleMask((restore) =>
      Effect.gen(function* () {
        if (scope.state._tag === "Closed") return yield* Effect.interrupt;
        // Not started immediately: a synchronous start could end the opening
        // before the finalizer below knows which fiber to spare.
        const fiber = yield* Effect.forkDetach(effect, {
          uninterruptible: false,
        });
        yield* Scope.addFinalizer(
          scope,
          Effect.gen(function* () {
            // Work that ends its own opening finishes what it is doing.
            if ((yield* Effect.fiberId) === fiber.id) return;
            yield* Fiber.interrupt(fiber).pipe(
              Effect.forkDetach({ startImmediately: true })
            );
          })
        );
        return yield* restore(Fiber.join(fiber)).pipe(
          Effect.onInterrupt(() => Fiber.interrupt(fiber))
        );
      })
    ),
  onEnd: (finalizer) => Scope.addFinalizer(scope, finalizer),
});

const makeOpenState = Effect.gen(function* () {
  // Openings are children of the modal's Scope, so tearing the modal down ends
  // the current opening and its work too.
  const owner = yield* Effect.scope;
  const state = yield* SubscriptionRef.make(false);
  const makeCurrent = Effect.gen(function* () {
    const scope = yield* Scope.fork(owner);
    return { opening: makeOpening(scope), scope } as const;
  });
  const current = yield* Ref.make(yield* makeCurrent);
  return {
    changes: SubscriptionRef.changes(state),
    current: SubscriptionRef.get(state),
    opening: Ref.get(current).pipe(Effect.map((value) => value.opening)),
    set: (open: boolean) =>
      Effect.uninterruptible(
        Effect.gen(function* () {
          const previous = yield* Ref.getAndSet(current, yield* makeCurrent);
          yield* Scope.close(previous.scope, Exit.void);
          yield* SubscriptionRef.set(state, open);
        })
      ),
  } satisfies WalletModalOpenState;
});

export class WalletModal extends Context.Service<
  WalletModal,
  {
    readonly chainOpen: WalletModalOpenState;
    readonly closeChain: Effect.Effect<void>;
    readonly connectOpen: WalletModalOpenState;
    readonly openConnect: Effect.Effect<void>;
    readonly presentationOpen: WalletModalOpenState;
  }
>()("@stakekit/widget/services/wallet/WalletModal") {
  static readonly layer = Layer.effect(
    WalletModal,
    Effect.gen(function* () {
      const chainOpen = yield* makeOpenState;
      const connectOpen = yield* makeOpenState;
      const presentationOpen = yield* makeOpenState;
      return WalletModal.of({
        chainOpen,
        closeChain: chainOpen.set(false),
        connectOpen,
        openConnect: connectOpen.set(true),
        presentationOpen,
      });
    })
  );
}
