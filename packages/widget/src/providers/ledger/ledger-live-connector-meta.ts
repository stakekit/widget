import type {
  Account,
  deserializeTransaction,
  WalletAPIClient,
} from "@ledgerhq/wallet-api-client";
import type { RawTransaction } from "@ledgerhq/wallet-api-core";
import type { Chain } from "@stakekit/rainbowkit";
import type { Effect, Result, Stream } from "effect";
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
  $disabledChains: Stream.Stream<Chain[]>;
  $currentAccountId: Stream.Stream<string | undefined>;
  $accountsOnCurrentChain: Stream.Stream<Account[]>;
  walletApiClient: WalletAPIClient;
  requestAndSwitchAccount: (chain: Chain) => Effect.Effect<Chain, Error>;
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
  }) => Result.Result<RawTransaction, string>;
};

type LedgerLiveConnector = Connector & ExtraProps;

export const isLedgerLiveConnector = (
  connector: Connector
): connector is LedgerLiveConnector => connector.id === configMeta.id;
