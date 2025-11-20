import type { SignerPayloadJSON } from "@polkadot/types/types";
import type { EitherAsync } from "purify-ts";
import type { Connector } from "wagmi";
import type { ConnectorWithFilteredChains } from "../../domain/types/connectors";

export const configMeta = { type: "substrateProvider" };

export type ExtraProps = ConnectorWithFilteredChains & {
  signTransaction: (payload: {
    tx: SignerPayloadJSON;
    metadataRpc: string;
    rawTx: string;
  }) => EitherAsync<Error, string>;
};

export type StorageItem = {
  "substrate.disconnected": boolean;
  "substrate.lastConnectedId": string;
};

type SubstrateConnector = Connector & ExtraProps;

export const isSubstrateConnector = (
  connector: Connector
): connector is SubstrateConnector => connector.type === configMeta.type;
