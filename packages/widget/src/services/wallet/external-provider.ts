import { Data, Effect, Schema } from "effect";
import {
  TransactionHash,
  WalletSignature,
} from "../../domain/identity/identifiers";
import type {
  SKBorrowTx,
  SKTx,
  SKWallet,
  SKZamaPermitMeta,
} from "../../public-api/types";
import type { ExternalProviderSnapshot } from "../config/external-provider-snapshot";
import type { Eip712TypedData } from "./wallet-commands";
import type {
  BorrowTransactionMeta,
  YieldTransactionMeta,
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
type HostOutcome<A extends TransactionHash | WalletSignature> = Effect.Effect<
  A,
  ExternalProviderError | ExternalProviderCancelled
>;

export class ExternalProvider {
  constructor(private variantProvider: CurrentRef<ExternalProviderSnapshot>) {}

  sendTransaction(
    tx: SKTx,
    txMeta: YieldTransactionMeta
  ): HostOutcome<TransactionHash> {
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
        LegacyTransactionOutcome
      ).pipe(
        // A bare string is the legacy success shape.
        Effect.map((result) =>
          typeof result === "string"
            ? { type: "success" as const, txHash: result }
            : result
        ),
        Effect.flatMap(toTransactionHash("yield"))
      );
    });
  }

  sendBorrowTransaction(
    tx: SKBorrowTx,
    txMeta: BorrowTransactionMeta
  ): HostOutcome<TransactionHash> {
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
        TransactionOutcome
      ).pipe(Effect.flatMap(toTransactionHash("borrow")));
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

  signMessage(messageHash: string): HostOutcome<WalletSignature> {
    return Effect.suspend(() =>
      callHost(
        () => this.variantProvider.current.provider.signMessage(messageHash),
        LegacySignatureOutcome
      ).pipe(
        // A bare string is the legacy success shape.
        Effect.map((result) =>
          typeof result === "string"
            ? { type: "success" as const, signature: result }
            : result
        ),
        Effect.flatMap(toSignature)
      )
    );
  }

  signTypedData(
    typedData: Eip712TypedData,
    txMeta: BorrowTransactionMeta
  ): HostOutcome<WalletSignature> {
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
        SignatureOutcome
      ).pipe(Effect.flatMap(toSignature));
    });
  }

  canSignZamaPermit(): boolean {
    return hasZamaPermitSigner(this.variantProvider.current.provider);
  }

  signZamaPermit(
    typedData: Eip712TypedData,
    meta: SKZamaPermitMeta
  ): HostOutcome<WalletSignature> {
    return Effect.suspend(() => {
      const provider = this.variantProvider.current.provider;
      if (!hasZamaPermitSigner(provider)) {
        return Effect.fail(
          new ExternalProviderError({
            customMessage: null,
            message: "Zama permit signing capability is unavailable",
          })
        );
      }

      return callHost(
        () => provider.signZamaPermit(typedData, meta),
        SignatureOutcome
      ).pipe(Effect.flatMap(toSignature));
    });
  }
}

const hasZamaPermitSigner = (
  provider: ExternalProviderSnapshot["provider"]
): provider is ExternalProviderSnapshot["provider"] &
  Required<Pick<SKWallet, "signZamaPermit">> =>
  typeof provider.signZamaPermit === "function";

const HostCancelled = Schema.Struct({ type: Schema.Literal("cancelled") });

/** A failed signature request: nothing was signed or broadcast. */
const SignatureError = Schema.Struct({
  type: Schema.Literal("error"),
  error: Schema.String,
});

/**
 * A failed transaction request. `txHash` reports one broadcast before the
 * failure; hosts may spell its absence as `undefined`.
 */
const TransactionError = Schema.Struct({
  ...SignatureError.fields,
  txHash: Schema.optional(TransactionHash),
});

const TransactionSuccess = Schema.Struct({
  type: Schema.Literal("success"),
  txHash: TransactionHash,
});

const SignatureSuccess = Schema.Struct({
  type: Schema.Literal("success"),
  signature: WalletSignature,
});

const TransactionOutcome = Schema.Union([
  TransactionSuccess,
  HostCancelled,
  TransactionError,
]);

const SignatureOutcome = Schema.Union([
  SignatureSuccess,
  HostCancelled,
  SignatureError,
]);

/** Yield callbacks also accept the legacy bare string. */
const LegacyTransactionOutcome = Schema.Union([
  TransactionHash,
  ...TransactionOutcome.members,
]);

const LegacySignatureOutcome = Schema.Union([
  WalletSignature,
  ...SignatureOutcome.members,
]);

/**
 * The hash of a transaction the host broadcast. A host that broadcast before
 * failing reports the hash with its error, so the transaction is tracked
 * rather than signed again.
 */
const toTransactionHash =
  (family: "borrow" | "yield") =>
  (result: typeof TransactionOutcome.Type): HostOutcome<TransactionHash> => {
    if (result.type === "success") return Effect.succeed(result.txHash);
    if (result.type === "error" && result.txHash !== undefined) {
      return Effect.logWarning(
        "External provider failed after broadcasting a transaction"
      ).pipe(
        Effect.annotateLogs({ error: result.error, family }),
        Effect.as(result.txHash)
      );
    }
    return failHost(result);
  };

const toSignature = (
  result: typeof SignatureOutcome.Type
): HostOutcome<WalletSignature> =>
  result.type === "success"
    ? Effect.succeed(result.signature)
    : failHost(result);

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
  result: typeof HostCancelled.Type | typeof SignatureError.Type
): Effect.Effect<never, ExternalProviderError | ExternalProviderCancelled> =>
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
