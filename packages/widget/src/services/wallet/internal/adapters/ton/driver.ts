import { Effect } from "effect";
import type { Connector } from "wagmi";
import {
  WalletBroadcastError,
  WalletCapabilityUnavailableError,
} from "../../../wallet-errors";
import type { WalletBroadcastResult } from "../../../wallet-transactions";
import { isTonConnector } from "./ton-connector-meta";

export const makeTonWalletDriver = ({
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
    WalletBroadcastError | WalletCapabilityUnavailableError
  > =>
    Effect.gen(function* () {
      if (!isTonConnector(connector)) {
        return yield* new WalletCapabilityUnavailableError({
          capability: "transaction",
          connectorId: connector.id,
        });
      }

      const signedTx = yield* connector
        .signTransaction(tx)
        .pipe(
          Effect.mapError(
            (cause) => new WalletBroadcastError({ cause, customMessage: null })
          )
        );

      return { broadcasted: true, signedTx };
    }),
});
