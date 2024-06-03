import type { Account } from "@ledgerhq/wallet-api-client";
import type {
  WalletAPIClient,
  deserializeTransaction,
} from "@ledgerhq/wallet-api-client";
import type { Chain } from "@stakekit/rainbowkit";
import type { EitherAsync } from "purify-ts";
import type { Observable } from "rxjs";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import type { ConnectorWithFilteredChains } from "../../domain/types/connectors";

export const configMeta = {
  id: "ledgerLive",
  name: "Ledger Live",
  type: "ledgerLive",
};

export type ExtraProps = ConnectorWithFilteredChains & {
  $disabledChains: Observable<Chain[]>;
  $currentAccountId: Observable<string | undefined>;
  $accountsOnCurrentChain: Observable<Account[]>;
  walletApiClient: WalletAPIClient;
  requestAndSwitchAccount: (chain: Chain) => EitherAsync<Error, Chain>;
  switchAccount: (account: Account) => void;
  noAccountPlaceholder: Address;
  deserializeTransaction: typeof deserializeTransaction;
};

type LedgerLiveConnector = Connector & ExtraProps;

export const isLedgerLiveConnector = (
  connector: Connector
): connector is LedgerLiveConnector => connector.id === configMeta.id;
