import { Effect, Result, Schema } from "effect";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import type { Network } from "../../../../../domain/network/network";
import { isEvmWalletNetwork } from "../../../../../domain/wallet/network";
import type {
  BittensorTx,
  SKBorrowTx,
  SKTx,
  TronTx,
} from "../../../../../public-api/types";
import type {
  ExternalProviderCancelled,
  ExternalProviderError,
} from "../../../external-provider";
import type {
  WalletSignBorrowTypedDataInput,
  WalletSignPermitInput,
} from "../../../wallet-commands";
import {
  WalletBroadcastError,
  WalletCapabilityUnavailableError,
  WalletDecodeError,
  WalletRequestCancelledError,
  WalletSigningError,
} from "../../../wallet-errors";
import type {
  BorrowTransactionMeta,
  WalletBroadcastResult,
  YieldTransactionMeta,
} from "../../../wallet-transactions";
import { decodeWalletPayload } from "../decode-wallet-payload";
import {
  decodeAndPrepareBorrowEvmTransaction,
  decodeAndPrepareEvmTransaction,
} from "../evm/transaction";
import {
  normalizeSolanaTransactionToHex,
  unsignedSolanaTransactionCodec,
} from "../solana/transaction";
import { substratePayloadCodec } from "../substrate/transaction";
import {
  normalizeTonTransactionToRaw,
  unsignedTonTransactionCodec,
} from "../ton/transaction";
import { unsignedTronTransactionCodec } from "../tron/transaction";
import { isExternalProviderConnector } from "./index";

type HostFailure = ExternalProviderCancelled | ExternalProviderError;

const toSendError = (cause: HostFailure) =>
  cause._tag === "ExternalProviderCancelled"
    ? new WalletRequestCancelledError({ operation: "transaction" })
    : new WalletBroadcastError({
        cause,
        customMessage: cause.customMessage,
      });

const toSigningError =
  (operation: "message" | "typed-data") => (cause: HostFailure) =>
    cause._tag === "ExternalProviderCancelled"
      ? new WalletRequestCancelledError({ operation })
      : new WalletSigningError({ cause, operation });

const tryResult = <A>(
  evaluate: () => A,
  message: string
): Result.Result<A, string> => {
  try {
    return Result.succeed(evaluate());
  } catch {
    return Result.fail(message);
  }
};

const decodeExternalProviderTransaction = ({
  address,
  network,
  tx,
}: {
  readonly address: Address;
  readonly network: Network;
  readonly tx: string;
}): Effect.Effect<SKTx, WalletDecodeError> => {
  if (isEvmWalletNetwork(network)) {
    return decodeAndPrepareEvmTransaction({ address, tx }).pipe(
      Effect.map((decodedTx): SKTx => ({ type: "evm", tx: decodedTx })),
      Effect.mapError((cause) => new WalletDecodeError({ cause }))
    );
  }

  const result: Result.Result<SKTx, string> = (() => {
    if (network === "solana") {
      return decodeWalletPayload(unsignedSolanaTransactionCodec, tx).pipe(
        Result.map((decodedTx) => ({
          type: "solana",
          tx: normalizeSolanaTransactionToHex(decodedTx),
        }))
      );
    }

    if (network === "ton") {
      return decodeWalletPayload(
        Schema.fromJsonString(unsignedTonTransactionCodec),
        tx
      ).pipe(
        Result.flatMap((decodedTx) =>
          tryResult(
            () => normalizeTonTransactionToRaw(decodedTx),
            "Failed to normalize TON tx"
          )
        ),
        Result.map((decodedTx) => ({ type: "ton", tx: decodedTx }))
      );
    }

    if (network === "tron") {
      return decodeWalletPayload(
        Schema.fromJsonString(unsignedTronTransactionCodec),
        tx
      ).pipe(
        Result.map((decodedTx) => ({ type: "tron", tx: decodedTx }) as TronTx)
      );
    }

    if (network === "bittensor") {
      return decodeWalletPayload(
        Schema.fromJsonString(substratePayloadCodec),
        tx
      ).pipe(
        Result.map(
          (decodedTx) => ({ type: "bittensor", tx: decodedTx }) as BittensorTx
        )
      );
    }

    return Result.fail("Unsupported network");
  })();

  return Result.isFailure(result)
    ? Effect.fail(new WalletDecodeError({ cause: result.failure }))
    : Effect.succeed(result.success);
};

const decodeBorrowExternalProviderTransaction = ({
  address,
  network,
  tx,
}: {
  readonly address: Address;
  readonly network: Network;
  readonly tx: string;
}): Effect.Effect<SKBorrowTx, WalletDecodeError> => {
  if (!isEvmWalletNetwork(network)) {
    return Effect.fail(
      new WalletDecodeError({ cause: "Unsupported Borrow network" })
    );
  }

  return decodeAndPrepareBorrowEvmTransaction({ address, tx }).pipe(
    Effect.map((decodedTx): SKBorrowTx => ({ type: "evm", tx: decodedTx })),
    Effect.mapError((cause) => new WalletDecodeError({ cause }))
  );
};

type ExternalProviderTransactionInput = {
  readonly address: Address;
  readonly network: Network;
  readonly tx: string;
} & (
  | {
      readonly family: "yield";
      readonly txMeta: YieldTransactionMeta;
    }
  | {
      readonly family: "borrow";
      readonly txMeta: BorrowTransactionMeta;
    }
);

export const makeExternalProviderWalletDriver = ({
  connector,
}: {
  readonly connector: Connector;
}) => ({
  signMessage: ({
    message,
  }: {
    readonly message: string;
  }): Effect.Effect<
    string,
    | WalletCapabilityUnavailableError
    | WalletRequestCancelledError
    | WalletSigningError
  > =>
    Effect.gen(function* () {
      if (!isExternalProviderConnector(connector)) {
        return yield* new WalletCapabilityUnavailableError({
          capability: "message",
          connectorId: connector.id,
        });
      }

      return yield* connector
        .signMessage(message)
        .pipe(Effect.mapError(toSigningError("message")));
    }),
  signTypedData: (
    input: WalletSignBorrowTypedDataInput
  ): Effect.Effect<
    string,
    | WalletCapabilityUnavailableError
    | WalletRequestCancelledError
    | WalletSigningError
  > =>
    Effect.gen(function* () {
      if (!isExternalProviderConnector(connector)) {
        return yield* new WalletCapabilityUnavailableError({
          capability: "typed-data",
          connectorId: connector.id,
        });
      }

      return yield* connector
        .signTypedData(input.typedData, input.txMeta)
        .pipe(Effect.mapError(toSigningError("typed-data")));
    }),
  signZamaPermit: (
    input: WalletSignPermitInput
  ): Effect.Effect<
    string,
    | WalletCapabilityUnavailableError
    | WalletRequestCancelledError
    | WalletSigningError
  > =>
    Effect.gen(function* () {
      if (
        !isExternalProviderConnector(connector) ||
        !connector.canSignZamaPermit()
      ) {
        return yield* new WalletCapabilityUnavailableError({
          capability: "typed-data",
          connectorId: connector.id,
        });
      }

      return yield* connector
        .signZamaPermit(input.typedData, input.meta)
        .pipe(Effect.mapError(toSigningError("typed-data")));
    }),
  signTransaction: (
    input: ExternalProviderTransactionInput
  ): Effect.Effect<
    WalletBroadcastResult,
    | WalletBroadcastError
    | WalletCapabilityUnavailableError
    | WalletDecodeError
    | WalletRequestCancelledError
  > =>
    Effect.gen(function* () {
      if (!isExternalProviderConnector(connector)) {
        return yield* new WalletCapabilityUnavailableError({
          capability: "transaction",
          connectorId: connector.id,
        });
      }

      const signedTx = yield* Effect.gen(function* () {
        if (input.family === "borrow") {
          const decodedTx = yield* decodeBorrowExternalProviderTransaction({
            address: input.address,
            network: input.network,
            tx: input.tx,
          });
          return yield* connector
            .sendBorrowTransaction(decodedTx, input.txMeta)
            .pipe(Effect.mapError(toSendError));
        }

        const decodedTx = yield* decodeExternalProviderTransaction({
          address: input.address,
          network: input.network,
          tx: input.tx,
        });
        return yield* connector
          .sendTransaction(decodedTx, input.txMeta)
          .pipe(Effect.mapError(toSendError));
      });

      return { broadcasted: true, signedTx } satisfies WalletBroadcastResult;
    }),
});
