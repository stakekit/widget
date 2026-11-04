import { Effect, Schema } from "effect";
import type { Address, Hex } from "viem";
import type { Connector } from "wagmi";
import type {
  ActionTransaction,
  YieldAction,
} from "../../domain/action/models";
import type { Action as BorrowAction } from "../../domain/borrow/execution/action";
import type { Transaction as BorrowTransaction } from "../../domain/borrow/execution/transaction";
import {
  SignedTransactionPayload,
  TransactionHash,
  WalletSignature,
} from "../../domain/identity/identifiers";
import type { Network } from "../../domain/network/network";
import type { Token } from "../../domain/token/token";
import * as LegacyApi from "../../generated/api/legacy-schema";
import { WalletBroadcastError, WalletSigningError } from "./wallet-errors";

type YieldProviderDetail = {
  readonly name: string;
  readonly address: string | undefined;
  readonly rewardRate: number | undefined;
  readonly rewardType: string | undefined;
  readonly website: string | undefined;
  readonly logo: string | undefined;
};

/** Action context the wallet receives with every yield signing request. */
export type YieldActionMeta = {
  readonly actionId: YieldAction["id"];
  readonly actionType: YieldAction["type"];
  readonly address: YieldAction["address"];
  readonly amount: string | null;
  readonly amountRaw: string | null;
  readonly rawArguments: YieldAction["rawArguments"];
  readonly yieldId: YieldAction["yieldId"];
  readonly inputToken: Token | undefined;
  // Mutable because the host contract publishes a mutable array.
  readonly providersDetails: Array<YieldProviderDetail>;
};

/** Every field is always present (possibly `undefined`): hosts receive it as-is. */
export type YieldTransactionMeta = YieldActionMeta & {
  readonly annotatedTransaction: ActionTransaction["annotatedTransaction"];
  readonly gasEstimate: ActionTransaction["gasEstimate"];
  readonly structuredTransaction: ActionTransaction["structuredTransaction"];
  readonly txId: ActionTransaction["id"];
  readonly txType: ActionTransaction["type"];
};

type BorrowRawArguments = NonNullable<BorrowAction["rawArguments"]>;

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
    readonly collateralTokenAddress?: NonNullable<
      BorrowRawArguments["collateralTokenAddress"]
    >;
    readonly marketId: BorrowRawArguments["marketId"];
    readonly repayAll?: boolean;
    readonly targetLtv?: string;
    readonly tokenAddress?: NonNullable<BorrowRawArguments["tokenAddress"]>;
  };
  readonly txId: BorrowTransaction["id"];
  readonly txType: BorrowTransaction["type"];
};

export const LegacyTransaction = LegacyApi.TransactionDto;
export type LegacyTransaction = typeof LegacyTransaction.Type;

type WalletEvmTransactionInputCommon = {
  readonly account?: Address;
  readonly chainId?: number;
  // `undefined` is passed to override a connector with Wagmi's current one.
  readonly connector?: Connector | undefined;
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
        readonly family: "yield";
        readonly txMeta: YieldTransactionMeta;
      }
    | {
        readonly family: "borrow";
        readonly txMeta: BorrowTransactionMeta;
      }
  );

export type WalletSignedPayloadResult = {
  readonly broadcasted: false;
  readonly signedTx: SignedTransactionPayload;
};

export type WalletBroadcastResult = {
  readonly broadcasted: true;
  readonly signedTx: TransactionHash;
};

/** What a wallet answered for a transaction it signed and broadcast. */
export const decodeWalletBroadcastResult = (
  hash: unknown
): Effect.Effect<WalletBroadcastResult, WalletBroadcastError> =>
  Schema.decodeUnknownEffect(TransactionHash)(hash).pipe(
    Effect.map((signedTx) => ({ broadcasted: true, signedTx }) as const),
    Effect.mapError(
      (cause) => new WalletBroadcastError({ cause, customMessage: null })
    )
  );

/** What a wallet answered for a transaction it signed but did not broadcast. */
export const decodeWalletSignedPayloadResult = (
  payload: unknown
): Effect.Effect<WalletSignedPayloadResult, WalletSigningError> =>
  Schema.decodeUnknownEffect(SignedTransactionPayload)(payload).pipe(
    Effect.map((signedTx) => ({ broadcasted: false, signedTx }) as const),
    Effect.mapError(
      (cause) => new WalletSigningError({ cause, operation: "transaction" })
    )
  );

/** The signature a wallet answered for a message or typed data. */
export const decodeWalletSignature = (
  signature: unknown,
  operation: "message" | "typed-data"
): Effect.Effect<WalletSignature, WalletSigningError> =>
  Schema.decodeUnknownEffect(WalletSignature)(signature).pipe(
    Effect.mapError((cause) => new WalletSigningError({ cause, operation }))
  );
