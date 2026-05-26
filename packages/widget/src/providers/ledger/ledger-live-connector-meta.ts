import type {
  Account,
  deserializeTransaction,
  WalletAPIClient,
} from "@ledgerhq/wallet-api-client";
import type { RawTransaction } from "@ledgerhq/wallet-api-core";
import type { Chain } from "@stakekit/rainbowkit";
import type { Either, EitherAsync } from "purify-ts";
import type { Observable } from "rxjs";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import type { ConnectorWithFilteredChains } from "../../domain/types/connectors";
import type { SKTxMeta } from "../../domain/types/wallets/generic-wallet";

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
  prepareTransaction: ({
    network,
    tx,
    txMeta,
  }: {
    network: string;
    tx: string;
    txMeta: SKTxMeta;
  }) => Either<string, RawTransaction>;
};

type LedgerLiveConnector = Connector & ExtraProps;

export const isLedgerLiveConnector = (
  connector: Connector
): connector is LedgerLiveConnector => connector.id === configMeta.id;
