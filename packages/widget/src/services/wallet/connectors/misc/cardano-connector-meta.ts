import type { Effect } from "effect";
import type { Connector } from "wagmi";
import type { ConnectorWithFilteredChains } from "../../../../domain/types/connectors";

export const configMeta = {
  type: "cardanoWallet",
} as const;

export type ExtraProps = ConnectorWithFilteredChains & {
  signTransaction: (tx: string) => Effect.Effect<string, Error>;
};

type CardanoConnector = Connector & ExtraProps;

export type StorageItem = {
  "cardano.disconnected": boolean;
  "cardano.lastConnectedWallet": {
    address: string;
    id: string;
  } | null;
};

export const isCardanoConnector = (
  connector: Connector
): connector is CardanoConnector => connector.type === "cardanoWallet";
