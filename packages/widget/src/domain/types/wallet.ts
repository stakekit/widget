import type { Account } from "@ledgerhq/wallet-api-client";
import type { EitherAsync } from "purify-ts";
import type { Chain } from "viem";
import type { Connector } from "wagmi";
import type {
  SendTransactionError,
  TransactionDecodeError,
} from "../../providers/sk-wallet/errors";
import type { Nullable } from "../../types/utils";
import type { LegacyTransaction } from "../schema/legacy-models";
import type { AddressWithTokenDtoAdditionalAddresses } from "./addresses";
import type { SupportedSKChains } from "./chains";
import type { Networks } from "./chains/networks";
import type { SKTxMeta } from "./wallets/generic-wallet";

type SignedTxOrMessage = string;

export type SKWallet = {
  disconnect: () => Promise<void>;
  signTransaction: (args: {
    tx: NonNullable<LegacyTransaction["unsignedTransaction"]>;
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
