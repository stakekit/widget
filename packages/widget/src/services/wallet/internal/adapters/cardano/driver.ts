import { Effect } from "effect";
import type { Connector } from "wagmi";
import {
  WalletCapabilityUnavailableError,
  WalletSigningError,
} from "../../../wallet-errors";
import type { WalletSignedPayloadResult } from "../../../wallet-transactions";
import { isCardanoConnector } from "./cardano-connector-meta";

export const makeCardanoWalletDriver = ({
  connector,
}: {
  readonly connector: Connector;
}) => ({
  signTransaction: ({
    tx,
  }: {
    readonly tx: string;
  }): Effect.Effect<
    WalletSignedPayloadResult,
    WalletCapabilityUnavailableError | WalletSigningError
  > =>
    Effect.gen(function* () {
      if (!isCardanoConnector(connector)) {
        return yield* new WalletCapabilityUnavailableError({
          capability: "transaction",
          connectorId: connector.id,
        });
      }

      const signedTx = yield* connector
        .signTransaction(tx)
        .pipe(
          Effect.mapError(
            (cause) =>
              new WalletSigningError({ cause, operation: "transaction" })
          )
        );

      return { broadcasted: false, signedTx };
    }),
});
