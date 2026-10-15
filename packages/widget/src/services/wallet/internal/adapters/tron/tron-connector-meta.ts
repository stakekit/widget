import type { Connector } from "wagmi";
import type { ConnectorWithFilteredChains } from "../../../wallet-connectors";
import type { UnsignedTronTransaction } from "./transaction";

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

/** What the Tron wagmi connector consumes from a wallet. */
export type TronWallet = Readonly<{
  address: () => string | null;
  connect: (input: { readonly isReconnecting: boolean }) => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: UnsignedTronTransaction) => Promise<unknown>;
  /** Whether a previous connection can resume without user interaction. */
  isAuthorized: () => Promise<boolean>;
  /** Registers `listener` for connections the wallet ends on its side. */
  onEnded?: (listener: () => void) => void;
}>;

export type ExtraProps = ConnectorWithFilteredChains &
  Pick<TronWallet, "signTransaction">;

type TronConnector = Connector & ExtraProps;

export type StorageItem = { "tron.disconnected": boolean };

export const isTronConnector = (
  connector: Connector
): connector is TronConnector =>
  Object.values(configMeta).some((val) => val.id === connector.id);
