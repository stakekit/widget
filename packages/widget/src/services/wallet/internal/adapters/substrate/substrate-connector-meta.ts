import type { SignerPayloadJSON } from "@polkadot/types/types";
import type { Effect } from "effect";
import type { Connector } from "wagmi";
import type { ConnectorWithFilteredChains } from "../../../wallet-connectors";
import type { WalletIntegrationError } from "../../../wallet-errors";

export const configMeta = { type: "substrateProvider" };

export type ExtraProps = ConnectorWithFilteredChains & {
  signTransaction: (payload: {
    tx: SignerPayloadJSON;
    metadataRpc: string;
    rawTx: string;
  }) => Effect.Effect<string, Error>;
};

export type StorageItem = {
  "substrate.disconnected": boolean;
  "substrate.lastConnectedId": string;
};

type SubstrateSignerResult = Readonly<{
  signature: `0x${string}`;
  /** Absent or null: the extrinsic is encoded locally from `signature`. */
  signedTransaction?: string | Uint8Array | null;
}>;

/** What the shared Substrate wagmi connector consumes from a wallet. */
export type SubstrateWallet = Readonly<{
  /** Establishes the connection; must not prompt while reconnecting. */
  connect: (options: { readonly isReconnecting: boolean }) => Promise<void>;
  disconnect: () => Promise<void>;
  /** Connected addresses usable on the wagmi chain `chainId`. */
  getAccounts: (chainId: number) => Promise<ReadonlyArray<string>>;
  /** Whether `connect({ isReconnecting: true })` can succeed silently. */
  canRestore: () => Promise<boolean>;
  signPayload: (
    payload: SignerPayloadJSON
  ) => Effect.Effect<SubstrateSignerResult, WalletIntegrationError>;
}>;
type SubstrateConnector = Connector & ExtraProps;

export const isSubstrateConnector = (
  connector: Connector
): connector is SubstrateConnector => connector.type === configMeta.type;
