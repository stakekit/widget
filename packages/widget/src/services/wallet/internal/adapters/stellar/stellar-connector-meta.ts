import type { Effect } from "effect";
import type { Connector } from "wagmi";
import type { ConnectorWithFilteredChains } from "../../../wallet-connectors";

export const stellarConnectorType = "stellar-wallet" as const;

type StellarSignTransactionInput = Readonly<{
  address: string;
  networkPassphrase: string;
  transactionXdr: string;
}>;

type StellarSignedTransaction = Readonly<{
  signedTxXdr: string;
  signerAddress?: string;
}>;

export type ExtraProps = ConnectorWithFilteredChains & {
  signTransaction: (
    input: StellarSignTransactionInput
  ) => Effect.Effect<StellarSignedTransaction, Error>;
};

export type StellarConnector = Connector & ExtraProps;

export const isStellarConnector = (
  connector: Connector
): connector is StellarConnector => connector.type === stellarConnectorType;
