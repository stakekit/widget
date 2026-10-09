import { Context, Effect, Layer, Stream, SubscriptionRef } from "effect";

type WalletModalOpenState = Readonly<{
  readonly changes: Stream.Stream<boolean>;
  readonly current: Effect.Effect<boolean>;
  readonly revision: Effect.Effect<number>;
  readonly set: (open: boolean) => Effect.Effect<void>;
}>;

const makeOpenState = Effect.gen(function* () {
  const state = yield* SubscriptionRef.make({ open: false, revision: 0 });
  return {
    changes: SubscriptionRef.changes(state).pipe(
      Stream.map((value) => value.open)
    ),
    current: SubscriptionRef.get(state).pipe(Effect.map((value) => value.open)),
    revision: SubscriptionRef.get(state).pipe(
      Effect.map((value) => value.revision)
    ),
    set: (open: boolean) =>
      SubscriptionRef.update(state, (value) => ({
        open,
        revision: value.revision + 1,
      })),
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
