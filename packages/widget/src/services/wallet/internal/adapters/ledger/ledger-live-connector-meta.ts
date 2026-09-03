import type {
  Account,
  deserializeTransaction,
  WalletAPIClient,
} from "@ledgerhq/wallet-api-client";
import type { RawTransaction } from "@ledgerhq/wallet-api-core";
import type { Chain } from "@stakekit/rainbowkit";
import type { Effect, Stream } from "effect";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import type { SKTxMeta } from "../../../../../public-api/types";
import type { ConnectorWithFilteredChains } from "../../../wallet-connectors";
import type { WalletIntegrationError } from "../../../wallet-errors";
import type { LedgerTransactionPreparationError } from "./prepare-ledger-live-transaction";

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
  requestAndSwitchAccount: (
    chain: Chain
  ) => Effect.Effect<Chain, WalletIntegrationError>;
  switchAccount: (account: Account) => void;
  noAccountPlaceholder: Address;
  deserializeTransaction: typeof deserializeTransaction;
  prepareTransaction: ({
    family,
    network,
    tx,
    txMeta,
  }: {
    family: "borrow" | "classic";
    network: string;
    tx: string;
    txMeta?: SKTxMeta;
  }) => Effect.Effect<RawTransaction, LedgerTransactionPreparationError>;
};

type LedgerLiveConnector = Connector & ExtraProps;

export const isLedgerLiveConnector = (
  connector: Connector
): connector is LedgerLiveConnector => connector.id === configMeta.id;
