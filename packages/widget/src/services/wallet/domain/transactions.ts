import type { Address, Hex } from "viem";
import type { Connector } from "wagmi";
import type { LegacyTransaction } from "../../../domain/schema/legacy-models";
import type { Network } from "../../../domain/schema/network-model";
import type { SKBorrowTxMeta, SKTxMeta } from "../../../public-api/types";

type WalletEvmTransactionInputCommon = {
  readonly account?: Address;
  readonly chainId?: number;
  readonly connector?: Connector;
  readonly data?: Hex;
  readonly gas?: bigint;
  readonly to: Address;
  readonly value?: bigint;
};

export type WalletEvmTransactionInput = WalletEvmTransactionInputCommon &
  (
    | {
        readonly gasPrice?: bigint;
        readonly maxFeePerGas?: never;
        readonly maxPriorityFeePerGas?: never;
        readonly type: "legacy";
      }
    | {
        readonly gasPrice?: never;
        readonly maxFeePerGas: bigint;
        readonly maxPriorityFeePerGas?: bigint;
        readonly type: "eip1559";
      }
  );

type WalletSignTransactionInputFields = {
  readonly ledgerHwAppId: string | null;
  readonly network: Network;
  readonly tx: NonNullable<LegacyTransaction["unsignedTransaction"]>;
};

export type WalletSignTransactionInput = WalletSignTransactionInputFields &
  (
    | {
        readonly family: "classic";
        readonly txMeta: SKTxMeta;
      }
    | {
        readonly family: "borrow";
        readonly txMeta: SKBorrowTxMeta;
      }
  );

export type WalletSignedPayloadResult = {
  readonly broadcasted: false;
  readonly signedTx: string;
};

export type WalletBroadcastResult = {
  readonly broadcasted: true;
  readonly signedTx: string;
};
