import type { Account } from "@ledgerhq/wallet-api-client";
import type { Chain } from "viem";
import type { Connector } from "wagmi";
import type { WalletAddress } from "../../domain/identity/identifiers";
import type { AdditionalAddresses } from "../../domain/wallet/address";

import type { SupportedSKChains } from "../../services/wallet/supported-chains";

export type SKWallet = {
  additionalAddresses: AdditionalAddresses | null;
  isLedgerLive: boolean;
  isLedgerLiveAccountPlaceholder: boolean;
  connectorChains: Chain[];
} & (
  | {
      network: SupportedSKChains;
      address: WalletAddress;
      chain: Chain;
      isConnected: true;
      isConnecting: false;
      ledgerAccounts: Account[];
      connector: Connector;
    }
  | {
      network: null;
      address: null;
      chain: null;
      isConnected: false;
      isConnecting: boolean;
      ledgerAccounts: null;
      connector: null;
    }
);
