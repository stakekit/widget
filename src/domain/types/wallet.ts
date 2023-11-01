import {
  AddressWithTokenDtoAdditionalAddresses,
  TransactionDto,
} from "@stakekit/api-hooks";
import { EitherAsync } from "purify-ts";
import {
  SendTransactionError,
  TransactionDecodeError,
} from "../../pages/steps/hooks/errors";
import { GetNetworkResult } from "@wagmi/core";
import { SupportedSKChains } from "./chains";
import { Account } from "@ledgerhq/wallet-api-client";

export type SKWallet = {
  disconnect: () => Promise<void>;
  signTransaction: (args: {
    tx: NonNullable<TransactionDto["unsignedTransaction"]>;
    index: number;
  }) => EitherAsync<
    TransactionDecodeError | SendTransactionError,
    { signedTx: string; broadcasted: boolean }
  >;
  additionalAddresses: AddressWithTokenDtoAdditionalAddresses | null;
  isLedgerLive: boolean;
  isReconnecting: boolean;
  isNotConnectedOrReconnecting: boolean;
} & (
  | {
      network: SupportedSKChains;
      address: string;
      chain: GetNetworkResult["chain"];
      isConnected: true;
      isConnecting: false;
      ledgerAccounts: Account[];
      onLedgerAccountChange: (account: Account) => void;
    }
  | {
      network: null;
      address: null;
      chain: null;
      isConnected: false;
      isConnecting: boolean;
      ledgerAccounts: null;
      onLedgerAccountChange: null;
    }
);
