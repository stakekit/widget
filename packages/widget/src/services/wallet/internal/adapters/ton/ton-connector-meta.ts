import type { Effect } from "effect";
import type { Connector } from "wagmi";
import type { ConnectorWithFilteredChains } from "../../../wallet-connectors";

export const configMeta = {
  type: "tonWallet",
} as const;

export type ExtraProps = ConnectorWithFilteredChains & {
  signTransaction: (tx: string) => Effect.Effect<string, Error>;
};

type TonConnector = Connector & ExtraProps;

export type StorageItem = {
  "ton.disconnected": boolean;
};

export const isTonConnector = (
  connector: Connector
): connector is TonConnector => connector.type === "tonWallet";
