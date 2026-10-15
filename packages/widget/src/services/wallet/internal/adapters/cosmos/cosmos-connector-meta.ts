import type { StdSignature } from "@cosmjs/amino";
import type { toBase64 } from "@cosmjs/encoding";
import type { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import type { Effect, Stream } from "effect";
import type { Connector } from "wagmi";
import type { ConnectorWithFilteredChains } from "../../../wallet-connectors";
import type { WalletIntegrationError } from "../../../wallet-errors";

export const configMeta = { type: "cosmosProvider" };

type CosmosAccount = Readonly<{
  address: string;
  pubkey: Uint8Array;
}>;

type CosmosDirectSignResponse = Readonly<{
  /** The document the wallet signed; it may differ from the requested one. */
  signed: SignDoc;
  signature: StdSignature;
}>;

/** The connected account's signer on one Cosmos chain. */
export type CosmosChainWallet = Readonly<{
  /** Cosmos chain id, e.g. `cosmoshub-4`. */
  chainId: string;
  getAccount: Effect.Effect<CosmosAccount, WalletIntegrationError>;
  signDirect: (
    signDoc: SignDoc
  ) => Effect.Effect<CosmosDirectSignResponse, WalletIntegrationError>;
}>;

export type ExtraProps = ConnectorWithFilteredChains & {
  /** The connected chain wallet; `null` while disconnected. */
  $chainWallet: Stream.Stream<CosmosChainWallet | null>;
  signTransaction: ({
    cw,
    tx,
  }: {
    cw: CosmosChainWallet;
    tx: string;
  }) => Effect.Effect<string, Error>;
  toBase64: typeof toBase64;
};

export type CosmosConnector = Connector & ExtraProps;

export const isCosmosConnector = (
  connector: Connector
): connector is CosmosConnector => connector.type === configMeta.type;
