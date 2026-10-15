import { Context, Effect, Layer } from "effect";
import { WalletIntegrationError } from "./wallet-errors";

export class WalletClipboard extends Context.Service<
  WalletClipboard,
  {
    readonly copyAddress: (
      address: string
    ) => Effect.Effect<void, WalletIntegrationError>;
  }
>()("stakekit/widget/wallet/WalletClipboard") {
  static readonly layer = Layer.succeed(
    WalletClipboard,
    WalletClipboard.of({
      copyAddress: (address) =>
        Effect.tryPromise({
          try: () => navigator.clipboard.writeText(address),
          catch: (cause) =>
            new WalletIntegrationError({
              cause,
              operation: "copy-address",
              message: "Could not copy wallet address",
            }),
        }),
    })
  );
}
