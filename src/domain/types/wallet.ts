import {
  AddressWithTokenDtoAdditionalAddresses,
  TransactionDto,
} from "@stakekit/api-hooks";
import { EitherAsync } from "purify-ts";
import {
  SendTransactionError,
  TransactionDecodeError,
} from "../../pages/steps/errors";
import { GetNetworkResult } from "@wagmi/core";
import { CosmosNetworks, EvmNetworks } from "@stakekit/common";

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
} & (
  | {
      network: EvmNetworks | CosmosNetworks;
      address: string;
      chain: GetNetworkResult["chain"];
      isConnected: true;
      isConnecting: false;
    }
  | {
      network: null;
      address: null;
      chain: null;
      isConnected: false;
      isConnecting: boolean;
    }
);
