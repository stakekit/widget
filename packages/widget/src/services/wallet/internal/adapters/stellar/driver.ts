import { Effect } from "effect";
import type { Connector } from "wagmi";
import { getProtocolChainIdentity } from "../../../../../domain/wallet/network";
import { WalletIntegrationError } from "../../../wallet-errors";
import type { WalletSignTransactionInput } from "../../../wallet-transactions";
import {
  requireTransactionSigner,
  signedPayloadResult,
} from "../transaction-signing";
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
      const stellar = yield* requireTransactionSigner(
        connector,
        isStellarConnector(connector) && input.network === "stellar"
          ? connector
          : null
      );

      return yield* signedPayloadResult(
        stellar
          .signTransaction({
            address: input.address,
            networkPassphrase: stellarMainnetIdentity.networkPassphrase,
            transactionXdr: input.tx,
          })
          .pipe(
            Effect.flatMap(
              ({
                signedTxXdr,
              }): Effect.Effect<string, WalletIntegrationError> =>
                signedTxXdr.trim().length === 0
                  ? Effect.fail(
                      new WalletIntegrationError({
                        message:
                          "Stellar wallet returned an empty signed transaction",
                        operation: "stellar-sign-transaction",
                      })
                    )
                  : Effect.succeed(signedTxXdr)
            )
          )
      );
    }
  );

  return { signTransaction };
};
