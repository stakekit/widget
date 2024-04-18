import type {
  AddressWithTokenDtoAdditionalAddresses,
  TransactionDto,
} from "@stakekit/api-hooks";
import type { EitherAsync } from "purify-ts";
import type {
  SendTransactionError,
  TransactionDecodeError,
} from "../../pages/steps/hooks/errors";
import type { SupportedSKChains } from "./chains";
import type { Account } from "@ledgerhq/wallet-api-client";
import type { Connector } from "wagmi";
import type { Chain } from "viem";
import type { Nullable } from "../../types";

type SignedTxOrMessage = string;

export type SKWallet = {
  disconnect: () => Promise<void>;
  signTransaction: (args: {
    tx: NonNullable<TransactionDto["unsignedTransaction"]>;
    ledgerHwAppId: Nullable<string>;
  }) => EitherAsync<
    TransactionDecodeError | SendTransactionError,
    { signedTx: SignedTxOrMessage; broadcasted: boolean }
  >;
  signMultipleTransactions: (args: {
    txs: NonNullable<TransactionDto["unsignedTransaction"]>[];
  }) => EitherAsync<
    TransactionDecodeError | SendTransactionError,
    { signedTx: SignedTxOrMessage; broadcasted: boolean }
  >;
  signMessage: (message: string) => EitherAsync<Error, SignedTxOrMessage>;
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
