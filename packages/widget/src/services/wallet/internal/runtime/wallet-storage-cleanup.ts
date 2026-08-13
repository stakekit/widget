import { Context, Data, Effect, Layer } from "effect";

export class WalletStorageCleanupError extends Data.TaggedError(
  "WalletStorageCleanupError"
)<{
  readonly cause: unknown;
}> {}

export class WalletStorageCleanup extends Context.Service<
  WalletStorageCleanup,
  {
    readonly clearOwnedStorage: Effect.Effect<void, WalletStorageCleanupError>;
  }
>()("stakekit/widget/wallet/WalletStorageCleanup") {
  /**
   * The default is deliberately a no-op. Logout previously enumerated and
   * deleted every IndexedDB database on the embedding origin, which could
   * remove data owned by the host application.
   *
   * TODO: Investigate which databases or keys are owned by the widget's wallet
   * integrations. Replace this default only with targeted cleanup through an
   * integration's supported API or exact widget-owned database identifiers.
   */
  static readonly layer = Layer.succeed(
    WalletStorageCleanup,
    WalletStorageCleanup.of({ clearOwnedStorage: Effect.void })
  );
}
