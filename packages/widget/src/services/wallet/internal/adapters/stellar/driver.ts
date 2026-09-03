import { Effect } from "effect";
import type { Connector } from "wagmi";
import { getProtocolChainIdentity } from "../../../../../domain/wallet/network";
import {
  WalletCapabilityUnavailableError,
  WalletIntegrationError,
  WalletSigningError,
} from "../../../wallet-errors";
import type { WalletSignTransactionInput } from "../../../wallet-transactions";
import { isStellarConnector } from "./stellar-connector-meta";

const stellarMainnetIdentity = getProtocolChainIdentity("stellar");

export const makeStellarWalletDriver = ({
  connector,
}: {
  readonly connector: Connector;
}) => {
  const signTransaction = Effect.fn("StellarWalletDriver.signTransaction")(
    function* (
      input: WalletSignTransactionInput & { readonly address: string }
    ) {
      if (!isStellarConnector(connector) || input.network !== "stellar") {
        return yield* new WalletCapabilityUnavailableError({
          capability: "transaction",
          connectorId: connector.id,
        });
      }

      const result = yield* connector
        .signTransaction({
          address: input.address,
          networkPassphrase: stellarMainnetIdentity.networkPassphrase,
          transactionXdr: input.tx,
        })
        .pipe(
          Effect.mapError(
            (cause) =>
              new WalletSigningError({ cause, operation: "transaction" })
          )
        );

      if (result.signedTxXdr.trim().length === 0) {
        return yield* new WalletSigningError({
          cause: new WalletIntegrationError({
            message: "Stellar wallet returned an empty signed transaction",
            operation: "stellar-sign-transaction",
          }),
          operation: "transaction",
        });
      }

      return { broadcasted: false, signedTx: result.signedTxXdr };
    }
  );

  return { signTransaction };
};
