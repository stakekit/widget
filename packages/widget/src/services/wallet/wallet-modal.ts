import { Context, Effect, Layer, Ref } from "effect";

export type WalletModalAdapter = Readonly<{
  readonly closeChain: () => void;
  readonly openConnect: () => void;
}>;

export type WalletModalOwner = object;

type WalletModalRegistration = Readonly<{
  readonly adapter: WalletModalAdapter;
  readonly owner: WalletModalOwner;
}>;

export class WalletModal extends Context.Service<
  WalletModal,
  {
    readonly closeChain: Effect.Effect<void>;
    readonly install: (
      owner: WalletModalOwner,
      adapter: WalletModalAdapter
    ) => Effect.Effect<void>;
    readonly openConnect: Effect.Effect<void>;
    readonly uninstall: (owner: WalletModalOwner) => Effect.Effect<void>;
  }
>()("@stakekit/widget/services/wallet/WalletModal") {
  static readonly layer = Layer.effect(
    WalletModal,
    Effect.gen(function* () {
      const current = yield* Ref.make<WalletModalRegistration | undefined>(
        undefined
      );

      const invoke = (method: keyof WalletModalAdapter): Effect.Effect<void> =>
        Ref.get(current).pipe(
          Effect.flatMap((registration) =>
            Effect.sync(() => {
              registration?.adapter[method]();
            })
          )
        );

      return WalletModal.of({
        closeChain: invoke("closeChain"),
        install: (owner, adapter) => Ref.set(current, { adapter, owner }),
        openConnect: invoke("openConnect"),
        uninstall: (owner) =>
          Ref.update(current, (registration) =>
            registration?.owner === owner ? undefined : registration
          ),
      });
    })
  );
}
