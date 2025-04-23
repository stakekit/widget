import type { Account } from "@ledgerhq/wallet-api-client";
import type {
  ActionDto,
  AddressWithTokenDtoAdditionalAddresses,
  Networks,
  TransactionDto,
} from "@stakekit/api-hooks";
import type { EitherAsync } from "purify-ts";
import type { Chain } from "viem";
import type { Connector } from "wagmi";
import type {
  SendTransactionError,
  TransactionDecodeError,
} from "../../pages/steps/hooks/errors";
import type { Nullable } from "../../types";
import type { SupportedSKChains } from "./chains";

type SignedTxOrMessage = string;

export type SKWallet = {
  disconnect: () => Promise<void>;
  signTransaction: (args: {
    tx: NonNullable<TransactionDto["unsignedTransaction"]>;
    txMeta: {
      txId: TransactionDto["id"];
      actionId: ActionDto["id"];
      actionType: ActionDto["type"];
      txType: TransactionDto["type"];
    };
    ledgerHwAppId: Nullable<string>;
    network: Networks;
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
