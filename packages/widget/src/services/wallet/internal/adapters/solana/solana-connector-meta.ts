import type { Adapter } from "@solana/wallet-adapter-base";
import type { Connector } from "wagmi";
import type { ConnectorWithFilteredChains } from "../../../wallet-connectors";
import type { SolanaWalletDescriptor } from "../../runtime/solana-runtime";
import type { DecodedSolanaTransaction } from "./transaction";

/** Desktop extension store pages, by wallet-adapter name. */
export const extensionInstallUrls: Readonly<Record<string, string>> = {
  Phantom:
    "https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa",
  Trust:
    "https://chromewebstore.google.com/detail/trust-wallet/egjidjbpglichdcondbcbdnbeeppgdph",
};

export type ExtraProps = ConnectorWithFilteredChains & {
  readonly solanaAdapter: Adapter;
  readonly solanaAdapterSource: SolanaWalletDescriptor["source"];
  sendTransaction: (tx: DecodedSolanaTransaction) => Promise<string>;
};

export type StorageItem = { "solana.disconnected": boolean };

export type SolanaConnector = Connector & ExtraProps;

export const isSolanaConnector = (
  connector: Connector
): connector is SolanaConnector =>
  !!("isSolanaConnector" in connector && connector.isSolanaConnector);
