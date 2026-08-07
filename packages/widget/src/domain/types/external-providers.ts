import { Data, Effect } from "effect";
import type {
  SKBorrowExternalProviders,
  SKBorrowTxMeta,
  SKExternalProviders,
  SKTx,
  SKTxMeta,
} from "../../public-api/types";

export class ExternalProviderError extends Data.TaggedError(
  "ExternalProviderError"
)<{
  readonly cause?: unknown;
  readonly customMessage: string | null;
  readonly message: string;
}> {}

export type CurrentRef<A> = {
  readonly current: A;
};

export type ExternalProviderSnapshot =
  | Readonly<SKExternalProviders>
  | Readonly<SKBorrowExternalProviders>;

const isBorrowExternalProvider = (
  snapshot: ExternalProviderSnapshot
): snapshot is Readonly<SKBorrowExternalProviders> =>
  snapshot.supportsBorrow === true;

export const hasValidBorrowProviderContract = (
  snapshot: ExternalProviderSnapshot
): boolean =>
  isBorrowExternalProvider(snapshot) &&
  typeof snapshot.provider.sendBorrowTransaction === "function";

export class ExternalProvider {
  constructor(private variantProvider: CurrentRef<ExternalProviderSnapshot>) {}

  sendTransaction(tx: SKTx, txMeta: SKTxMeta) {
    const sendTransaction =
      this.variantProvider.current.provider.sendTransaction;

    if (!sendTransaction) {
      return Effect.fail(
        new ExternalProviderError({
          customMessage: null,
          message: "Invalid provider type",
        })
      );
    }

    return sendExternalTransaction(() => sendTransaction(tx, txMeta));
  }

  sendBorrowTransaction(tx: SKTx, txMeta: SKBorrowTxMeta) {
    const config = this.variantProvider.current;
    if (!isBorrowExternalProvider(config)) {
      return Effect.fail(
        new ExternalProviderError({
          customMessage: null,
          message: "Borrow transaction capability is unavailable",
        })
      );
    }

    return sendExternalTransaction(() =>
      config.provider.sendBorrowTransaction(tx, txMeta)
    );
  }

  switchChain({ chainId }: { chainId: number }) {
    return Effect.tryPromise({
      try: () => this.variantProvider.current.provider.switchChain(chainId),
      catch: (cause) =>
        new ExternalProviderError({
          cause,
          customMessage: null,
          message: "Failed to switch chain",
        }),
    });
  }

  signMessage(messageHash: string) {
    return Effect.tryPromise({
      try: () => this.variantProvider.current.provider.signMessage(messageHash),
      catch: toExternalProviderError,
    });
  }
}

const getExternalProviderErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return null;
};

const toExternalProviderError = (error: unknown) => {
  const customMessage = getExternalProviderErrorMessage(error);

  return new ExternalProviderError({
    cause: error,
    customMessage,
    message: customMessage ?? "External provider failed",
  });
};

type ExternalTransactionResult = Awaited<
  ReturnType<SKExternalProviders["provider"]["sendTransaction"]>
>;

const sendExternalTransaction = (
  send: () => Promise<ExternalTransactionResult>
) =>
  Effect.tryPromise({
    try: send,
    catch: toExternalProviderError,
  }).pipe(
    Effect.flatMap((result) => {
      if (typeof result === "string") {
        return Effect.succeed(result);
      }

      if (result.type === "success") {
        return Effect.succeed(result.txHash);
      }

      return Effect.fail(
        new ExternalProviderError({
          customMessage: result.error,
          message: result.error ?? "External provider failed",
        })
      );
    })
  );
