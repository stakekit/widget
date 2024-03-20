import {
  AddressWithTokenDtoAdditionalAddresses,
  TransactionDto,
} from "@stakekit/api-hooks";
import { EitherAsync } from "purify-ts";
import {
  SendTransactionError,
  TransactionDecodeError,
} from "../../pages/steps/hooks/errors";
import { SupportedSKChains } from "./chains";
import { Account } from "@ledgerhq/wallet-api-client";
import { Connector } from "wagmi";
import { Chain } from "viem";

export type SKWallet = {
  disconnect: () => Promise<void>;
  signTransaction: (args: {
    tx: NonNullable<TransactionDto["unsignedTransaction"]>;
  }) => EitherAsync<
    TransactionDecodeError | SendTransactionError,
    { signedTx: string; broadcasted: boolean }
  >;
  signMultipleTransactions: (args: {
    txs: NonNullable<TransactionDto["unsignedTransaction"]>[];
  }) => EitherAsync<
    TransactionDecodeError | SendTransactionError,
    { signedTx: string; broadcasted: boolean }
  >;
  additionalAddresses: AddressWithTokenDtoAdditionalAddresses | null;
  isLedgerLive: boolean;
  isLedgerLiveAccountPlaceholder: boolean;
  connectorChains: Chain[];
} & (
  | {
      network: SupportedSKChains;
      address: string;
      chain: Chain;
      isConnected: true;
      isConnecting: false;
      ledgerAccounts: Account[];
      onLedgerAccountChange: (account: Account) => void;
      connector: Connector;
    }
  | {
      network: null;
      address: null;
      chain: null;
      isConnected: false;
      isConnecting: boolean;
      ledgerAccounts: null;
      onLedgerAccountChange: null;
      connector: null;
    }
);
