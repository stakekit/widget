import { Data, Effect } from "effect";
import type { RefObject } from "react";
import type { SKExternalProviders } from "./wallets";
import type { SKTx, SKTxMeta } from "./wallets/generic-wallet";

export class ExternalProviderError extends Data.TaggedError(
  "ExternalProviderError"
)<{
  readonly cause?: unknown;
  readonly customMessage: string | null;
  readonly message: string;
}> {}

export class ExternalProvider {
  constructor(private variantProvider: RefObject<SKExternalProviders>) {}

  sendTransaction(tx: SKTx, txMeta: SKTxMeta) {
    const sendTransaction =
      this.variantProvider.current.provider.sendTransaction;

    if (!sendTransaction) {
      return Effect.fail(new Error("Invalid provider type"));
    }

    return Effect.tryPromise({
      try: () => sendTransaction(tx, txMeta),
      catch: toExternalProviderError,
    }).pipe(
      Effect.flatMap((res) => {
        if (typeof res === "string") {
          return Effect.succeed(res);
        }

        if (res.type === "success") {
          return Effect.succeed(res.txHash);
        }

        return Effect.fail(
          new ExternalProviderError({
            customMessage: res.error,
            message: res.error ?? "External provider failed",
          })
        );
      })
    );
  }

  switchChain({ chainId }: { chainId: number }) {
    return Effect.tryPromise({
      try: () => this.variantProvider.current.provider.switchChain(chainId),
      catch: (error) => new Error("Failed to switch chain", { cause: error }),
    });
  }

  signMessage(messageHash: string) {
    return Effect.tryPromise({
      try: () => this.variantProvider.current.provider.signMessage(messageHash),
      catch: toExternalProviderError,
    });
  }
}

const toExternalProviderError = (error: unknown) =>
  new ExternalProviderError({
    cause: error,
    customMessage:
      error instanceof Error && error.message
        ? error.message
        : typeof error === "string" && error
          ? error
          : null,
    message:
      error instanceof Error && error.message
        ? error.message
        : typeof error === "string" && error
          ? error
          : "External provider failed",
  });
