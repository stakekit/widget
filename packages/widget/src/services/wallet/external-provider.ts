import { Data, Effect, Schema } from "effect";
import type { SKBorrowTx, SKTx } from "../../public-api/types";
import type { ExternalProviderSnapshot } from "../config/external-provider-snapshot";
import type { Eip712TypedData } from "./wallet-commands";
import type {
  BorrowTransactionMeta,
  ClassicTransactionMeta,
} from "./wallet-transactions";

export class ExternalProviderError extends Data.TaggedError(
  "ExternalProviderError"
)<{
  readonly cause?: unknown;
  readonly customMessage: string | null;
  readonly message: string;
}> {}

/** The host reported that the user declined the request in the wallet. */
export class ExternalProviderCancelled extends Data.TaggedError(
  "ExternalProviderCancelled"
) {}

export type CurrentRef<A> = {
  readonly current: A;
};

/** A host call: its broadcast hash or signature, or why it failed. */
type HostOutcome = Effect.Effect<
  string,
  ExternalProviderError | ExternalProviderCancelled
>;

export class ExternalProvider {
  constructor(private variantProvider: CurrentRef<ExternalProviderSnapshot>) {}

  sendTransaction(tx: SKTx, txMeta: ClassicTransactionMeta): HostOutcome {
    return Effect.suspend(() => {
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

      return callHost(
        () => sendTransaction(tx, txMeta),
        TransactionResult
      ).pipe(
        Effect.flatMap((result): HostOutcome => {
          if (typeof result === "string") return Effect.succeed(result);
          return result.type === "success"
            ? Effect.succeed(result.txHash)
            : failHost(result);
        })
      );
    });
  }

  sendBorrowTransaction(
    tx: SKBorrowTx,
    txMeta: BorrowTransactionMeta
  ): HostOutcome {
    return Effect.suspend(() => {
      const config = this.variantProvider.current;
      if (!config.borrow) {
        return Effect.fail(
          new ExternalProviderError({
            customMessage: null,
            message: "Borrow transaction capability is unavailable",
          })
        );
      }

      return callHost(
        () => config.provider.sendBorrowTransaction(tx, txMeta),
        BorrowTransactionResult
      ).pipe(
        Effect.flatMap((result): HostOutcome => {
          if (result.type === "success") return Effect.succeed(result.txHash);
          // Broadcast before failing: track it rather than sign again.
          if (result.type === "error" && result.txHash !== undefined) {
            return Effect.logWarning(
              "External provider failed after broadcasting a Borrow transaction"
            ).pipe(
              Effect.annotateLogs({ error: result.error }),
              Effect.as(result.txHash)
            );
          }
          return failHost(result);
        })
      );
    });
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

  signMessage(messageHash: string): HostOutcome {
    return Effect.suspend(() =>
      callHost(
        () => this.variantProvider.current.provider.signMessage(messageHash),
        SignMessageResult
      ).pipe(
        Effect.flatMap((result): HostOutcome => {
          if (typeof result === "string") return Effect.succeed(result);
          return result.type === "success"
            ? Effect.succeed(result.signature)
            : failHost(result);
        })
      )
    );
  }

  signTypedData(
    typedData: Eip712TypedData,
    txMeta: BorrowTransactionMeta
  ): HostOutcome {
    return Effect.suspend(() => {
      const config = this.variantProvider.current;
      if (!config.borrow) {
        return Effect.fail(
          new ExternalProviderError({
            customMessage: null,
            message: "Borrow typed-data signing capability is unavailable",
          })
        );
      }

      return callHost(
        () => config.provider.signTypedData(typedData, txMeta),
        BorrowSignatureResult
      ).pipe(
        Effect.flatMap(
          (result): HostOutcome =>
            result.type === "success"
              ? Effect.succeed(result.signature)
              : failHost(result)
        )
      );
    });
  }
}

const HostCancelled = Schema.Struct({ type: Schema.Literal("cancelled") });

const HostError = Schema.Struct({
  type: Schema.Literal("error"),
  error: Schema.String,
});

const TransactionResult = Schema.Union([
  Schema.NonEmptyString,
  Schema.Struct({
    type: Schema.Literal("success"),
    txHash: Schema.NonEmptyString,
  }),
  HostCancelled,
  HostError,
]);

const SignMessageResult = Schema.Union([
  Schema.NonEmptyString,
  Schema.Struct({
    type: Schema.Literal("success"),
    signature: Schema.NonEmptyString,
  }),
  HostCancelled,
  HostError,
]);

const BorrowTransactionResult = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("success"),
    txHash: Schema.NonEmptyString,
  }),
  HostCancelled,
  Schema.Struct({
    type: Schema.Literal("error"),
    error: Schema.String,
    txHash: Schema.optionalKey(Schema.NonEmptyString),
  }),
]);

const BorrowSignatureResult = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("success"),
    signature: Schema.NonEmptyString,
  }),
  HostCancelled,
  HostError,
]);

/** Calls a host callback and decodes its result; rejections are errors. */
const callHost = <S extends Schema.Top>(
  call: () => Promise<unknown>,
  schema: S
) =>
  Effect.tryPromise({ try: call, catch: toExternalProviderError }).pipe(
    Effect.flatMap((result) =>
      Schema.decodeUnknownEffect(schema)(result).pipe(
        Effect.mapError(
          (cause) =>
            new ExternalProviderError({
              cause,
              customMessage: null,
              message: "Invalid external provider result",
            })
        )
      )
    )
  );

const failHost = (
  result: typeof HostCancelled.Type | typeof HostError.Type
): HostOutcome =>
  result.type === "cancelled"
    ? Effect.fail(new ExternalProviderCancelled())
    : Effect.fail(hostResultError(result.error));

const hostResultError = (error: string) =>
  new ExternalProviderError({
    customMessage: error || null,
    message: error || "External provider failed",
  });

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
