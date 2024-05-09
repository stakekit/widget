import type { Adapter } from "@tronweb3/tronwallet-abstract-adapter";
import type { ConnectorWithFilteredChains } from "../../domain/types/connectors";
import type { Connector } from "wagmi";

export const configMeta = {
  tronLink: {
    id: "tronLink",
    name: "TronLink",
    type: "tronLinkProvider",
  },
  tronWc: {
    id: "tronWc",
    name: "Wallet Connect",
    type: "tronWcProvider",
  },
  tronBg: {
    id: "tronBg",
    name: "Bitget",
    type: "tronBgProvider",
  },
  tronLedger: {
    id: "tronLedger",
    name: "Ledger",
    type: "tronLedgerProvider",
  },
} as const;

export type ExtraProps = ConnectorWithFilteredChains &
  Pick<Adapter, "signTransaction">;

type TronConnector = Connector & ExtraProps;

export const isTronConnector = (
  connector: Connector
): connector is TronConnector =>
  Object.values(configMeta).some((val) => val.id === connector.id);
