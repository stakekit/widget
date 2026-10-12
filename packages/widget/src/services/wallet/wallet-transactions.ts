import type { Address, Hex } from "viem";
import type { Connector } from "wagmi";
import type {
  ActionTransaction,
  YieldAction,
} from "../../domain/action/models";
import type { Action as BorrowAction } from "../../domain/borrow/execution/action";
import type { Transaction as BorrowTransaction } from "../../domain/borrow/execution/transaction";
import type { Network } from "../../domain/network/network";
import type { Token } from "../../domain/token/token";
import * as LegacyApi from "../../generated/api/legacy-schema";

type ClassicProviderDetail = {
  readonly name: string;
  readonly address: string | undefined;
  readonly rewardRate: number | undefined;
  readonly rewardType: string | undefined;
  readonly website: string | undefined;
  readonly logo: string | undefined;
};

/** Action context the wallet receives with every classic signing request. */
export type ClassicActionMeta = {
  readonly actionId: YieldAction["id"];
  readonly actionType: YieldAction["type"];
  readonly address: YieldAction["address"];
  readonly amount: string | null;
  readonly amountRaw: string | null;
  readonly rawArguments: YieldAction["rawArguments"];
  readonly yieldId: YieldAction["yieldId"];
  readonly inputToken: Token | undefined;
  // Mutable because the host contract publishes a mutable array.
  readonly providersDetails: Array<ClassicProviderDetail>;
};

export type ClassicTransactionMeta = ClassicActionMeta & {
  readonly annotatedTransaction: ActionTransaction["annotatedTransaction"];
  readonly gasEstimate: ActionTransaction["gasEstimate"];
  readonly structuredTransaction: ActionTransaction["structuredTransaction"];
  readonly txId: ActionTransaction["id"];
  readonly txType: ActionTransaction["type"];
};

export type BorrowTransactionMeta = {
  readonly actionId: BorrowAction["id"];
  readonly actionType: BorrowAction["action"];
  readonly address: BorrowAction["address"];
  readonly integrationId: BorrowAction["integrationId"];
  readonly rawArguments: {
    readonly amount?: string;
    readonly amountRaw?: string;
    readonly borrowAmount?: string;
    readonly collateralAmount?: string;
    readonly collateralAmountRaw?: string;
    readonly collateralTokenAddress?: string;
    readonly marketId: string;
    readonly repayAll?: boolean;
    readonly targetLtv?: string;
    readonly tokenAddress?: string;
  };
  readonly txId: BorrowTransaction["id"];
  readonly txType: BorrowTransaction["type"];
};

export const LegacyTransaction = LegacyApi.TransactionDto;
export type LegacyTransaction = typeof LegacyTransaction.Type;

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
        readonly txMeta: ClassicTransactionMeta;
      }
    | {
        readonly family: "borrow";
        readonly txMeta: BorrowTransactionMeta;
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
