import type { Account } from "@ledgerhq/wallet-api-client";
import type {
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
} from "../../providers/sk-wallet/errors";
import type { Nullable } from "../../types/utils";
import type { SupportedSKChains } from "./chains";
import type { SKTxMeta } from "./wallets/generic-wallet";

type SignedTxOrMessage = string;

export type SKWallet = {
  disconnect: () => Promise<void>;
  signTransaction: (args: {
    tx: NonNullable<TransactionDto["unsignedTransaction"]>;
    txMeta: SKTxMeta;
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
