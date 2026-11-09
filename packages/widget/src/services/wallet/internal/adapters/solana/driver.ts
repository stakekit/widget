import { Effect, Schema } from "effect";
import type { Connector } from "wagmi";

import {
  WalletBroadcastError,
  type WalletCapabilityUnavailableError,
  WalletDecodeError,
} from "../../../wallet-errors";
import {
  decodeWalletBroadcastResult,
  type WalletBroadcastResult,
} from "../../../wallet-transactions";
import { requireTransactionSigner } from "../transaction-signing";
import { isSolanaConnector } from "./solana-connector-meta";
import { unsignedSolanaTransactionCodec } from "./transaction";

export const makeSolanaWalletDriver = ({
  connector,
}: {
  readonly connector: Connector;
}) => ({
  signTransaction: ({
    tx,
  }: {
    readonly tx: string;
  }): Effect.Effect<
    WalletBroadcastResult,
    WalletBroadcastError | WalletCapabilityUnavailableError | WalletDecodeError
  > =>
    Effect.gen(function* () {
      const solana = yield* requireTransactionSigner(
        connector,
        isSolanaConnector(connector) ? connector : null
      );
      const decodedTx = yield* Schema.decodeEffect(
        unsignedSolanaTransactionCodec
      )(tx).pipe(Effect.mapError((cause) => new WalletDecodeError({ cause })));

      const signedTx = yield* Effect.tryPromise({
        try: () => solana.sendTransaction(decodedTx),
        catch: (cause) =>
          new WalletBroadcastError({ cause, customMessage: null }),
      });

      return yield* decodeWalletBroadcastResult(signedTx);
    }),
});
