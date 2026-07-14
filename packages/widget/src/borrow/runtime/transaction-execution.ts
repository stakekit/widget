import { Context, Data, Effect, Layer, PubSub, Schema, Stream } from "effect";
import type { Network } from "../../domain/schema/network-model";

import type { SKTxMeta } from "../../domain/types/wallets/generic-wallet";
import { WalletService } from "../../providers/wallet/runtime/service";
import type {
  Action,
  SubmitTransactionCommand,
  SubmitTransactionResult,
  Transaction,
} from "../domain";
import { toBorrowWalletStateProjection } from "../wallet/bridge";

export type BorrowExecutionPhase =
  | "creating"
  | "signing"
  | "submitting"
  | "confirming"
  | "stepping"
  | "completed";

export type BorrowSubmittedTransaction = {
  readonly hash: string;
  readonly link?: string;
  readonly signedPayload?: string;
  readonly status?: SubmitTransactionResult["status"];
  readonly transaction: Transaction;
};

export type BorrowExecutionResult = {
  readonly action: Action;
  readonly submissions: ReadonlyArray<BorrowSubmittedTransaction>;
};

type BorrowExecutionErrorFields = {
  readonly actionId?: string;
  readonly cause?: unknown;
  readonly message: string;
  readonly phase: BorrowExecutionPhase;
  readonly transactionId?: string;
};

export class BorrowWalletDisconnectedError extends Data.TaggedError(
  "BorrowWalletDisconnectedError"
)<BorrowExecutionErrorFields> {}

export class BorrowWalletStateChangedError extends Data.TaggedError(
  "BorrowWalletStateChangedError"
)<BorrowExecutionErrorFields> {}

export class BorrowSigningFailedError extends Data.TaggedError(
  "BorrowSigningFailedError"
)<BorrowExecutionErrorFields> {}

export class BorrowPayloadDecodeError extends Data.TaggedError(
  "BorrowPayloadDecodeError"
)<BorrowExecutionErrorFields> {}

export class BorrowSubmitFailedError extends Data.TaggedError(
  "BorrowSubmitFailedError"
)<BorrowExecutionErrorFields> {}

export class BorrowCheckFailedError extends Data.TaggedError(
  "BorrowCheckFailedError"
)<BorrowExecutionErrorFields> {}

export class BorrowTransactionFailedError extends Data.TaggedError(
  "BorrowTransactionFailedError"
)<BorrowExecutionErrorFields> {}

export class BorrowTransactionNotConfirmedError extends Data.TaggedError(
  "BorrowTransactionNotConfirmedError"
)<BorrowExecutionErrorFields> {}

export class BorrowActionStepFailedError extends Data.TaggedError(
  "BorrowActionStepFailedError"
)<BorrowExecutionErrorFields> {}

export class BorrowActionCompletionFailedError extends Data.TaggedError(
  "BorrowActionCompletionFailedError"
)<BorrowExecutionErrorFields> {}

export type BorrowTransactionExecutionError =
  | BorrowWalletDisconnectedError
  | BorrowWalletStateChangedError
  | BorrowSigningFailedError
  | BorrowPayloadDecodeError
  | BorrowSubmitFailedError
  | BorrowCheckFailedError
  | BorrowTransactionFailedError
  | BorrowTransactionNotConfirmedError
  | BorrowActionStepFailedError
  | BorrowActionCompletionFailedError;

const borrowTransactionExecutionErrorTags = new Set([
  "BorrowWalletDisconnectedError",
  "BorrowWalletStateChangedError",
  "BorrowSigningFailedError",
  "BorrowPayloadDecodeError",
  "BorrowSubmitFailedError",
  "BorrowCheckFailedError",
  "BorrowTransactionFailedError",
  "BorrowTransactionNotConfirmedError",
  "BorrowActionStepFailedError",
  "BorrowActionCompletionFailedError",
]);

export const isBorrowTransactionExecutionError = (
  value: unknown
): value is BorrowTransactionExecutionError =>
  typeof value === "object" &&
  value !== null &&
  "_tag" in value &&
  typeof value._tag === "string" &&
  borrowTransactionExecutionErrorTags.has(value._tag);

export type BorrowSignedTransaction = {
  readonly broadcasted: boolean;
  readonly signedTx: string;
};

export type BorrowWalletSignRequest = {
  readonly action: Action;
  readonly network: Network;
  readonly transaction: Transaction;
  readonly tx: string;
  readonly txMeta: SKTxMeta;
};

const borrowWalletErrorFields = (
  request: BorrowWalletSignRequest,
  message: string,
  cause?: unknown
): BorrowExecutionErrorFields => ({
  actionId: request.action.id,
  cause,
  message,
  phase: "signing",
  transactionId: request.transaction.id,
});

const validateBorrowWalletState = (
  request: BorrowWalletSignRequest,
  wallet: WalletService["Service"]
) =>
  Effect.gen(function* () {
    const projection = toBorrowWalletStateProjection(wallet.getState());

    if (projection.status === "disconnected") {
      return yield* new BorrowWalletDisconnectedError(
        borrowWalletErrorFields(request, "Wallet is disconnected.")
      );
    }

    if (projection.status === "unsupported-network") {
      return yield* new BorrowWalletStateChangedError(
        borrowWalletErrorFields(
          request,
          "Wallet changed to an unsupported borrow network."
        )
      );
    }

    if (
      projection.wallet.currentAccount.address.toLowerCase() !==
      request.action.address.toLowerCase()
    ) {
      return yield* new BorrowWalletStateChangedError(
        borrowWalletErrorFields(
          request,
          "Wallet account changed during borrow execution."
        )
      );
    }

    if (projection.wallet.network !== request.network) {
      return yield* new BorrowWalletStateChangedError(
        borrowWalletErrorFields(
          request,
          "Wallet network changed during borrow execution."
        )
      );
    }
  });

const makeBorrowWalletExecution = (wallet: WalletService["Service"]) => ({
  signTransaction: (request: BorrowWalletSignRequest) =>
    Effect.gen(function* () {
      yield* validateBorrowWalletState(request, wallet);

      return yield* wallet
        .signTransaction({
          ledgerHwAppId: null,
          network: request.network,
          tx: request.tx,
          txMeta: request.txMeta,
        })
        .pipe(
          Effect.mapError((cause) =>
            cause._tag === "WalletCapabilityUnavailableError"
              ? new BorrowWalletDisconnectedError(
                  borrowWalletErrorFields(
                    request,
                    "Wallet disconnected before signing completed.",
                    cause
                  )
                )
              : new BorrowSigningFailedError(
                  borrowWalletErrorFields(
                    request,
                    "Wallet signing failed.",
                    cause
                  )
                )
          )
        );
    }),
});

export class BorrowWalletExecutionService extends Context.Service<BorrowWalletExecutionService>()(
  "stakekit/widget/borrow/BorrowWalletExecutionService",
  {
    make: Effect.map(WalletService, makeBorrowWalletExecution),
  }
) {
  static readonly layer = Layer.effect(
    BorrowWalletExecutionService,
    BorrowWalletExecutionService.make
  );
}

export type BorrowExecutionEvent =
  | {
      readonly _tag: "BorrowActionCompleted";
      readonly action: Action;
      readonly submissions: ReadonlyArray<BorrowSubmittedTransaction>;
    }
  | {
      readonly _tag: "BorrowTransactionSubmitted";
      readonly action: Action;
      readonly submissions: ReadonlyArray<BorrowSubmittedTransaction>;
      readonly transaction: Transaction;
    };

const BORROW_EXECUTION_EVENT_REPLAY_SIZE = 8;

export class BorrowExecutionEventsService extends Context.Service<BorrowExecutionEventsService>()(
  "stakekit/widget/borrow/BorrowExecutionEventsService",
  {
    make: Effect.gen(function* () {
      const pubsub = yield* PubSub.sliding<BorrowExecutionEvent>({
        capacity: 64,
        replay: BORROW_EXECUTION_EVENT_REPLAY_SIZE,
      });

      yield* Effect.addFinalizer(() => PubSub.shutdown(pubsub));

      return {
        events: Stream.fromPubSub(pubsub),
        publish: (event: BorrowExecutionEvent) =>
          PubSub.publish(pubsub, event).pipe(Effect.asVoid),
      } as const;
    }),
  }
) {
  static readonly layer = Layer.effect(
    BorrowExecutionEventsService,
    BorrowExecutionEventsService.make
  );
}

const HexString = Schema.TemplateLiteral([Schema.Literal("0x"), Schema.String]);

const Numberish = Schema.Union([Schema.String, Schema.Number, Schema.BigInt]);

export const BorrowEvmSignablePayload = Schema.Struct({
  chainId: Schema.optionalKey(Numberish),
  data: HexString,
  from: HexString,
  gasLimit: Numberish,
  nonce: Schema.optionalKey(Numberish),
  to: HexString,
  type: Schema.optionalKey(Numberish),
  value: Schema.optionalKey(Numberish),
});

export type BorrowEvmSignablePayload = typeof BorrowEvmSignablePayload.Type;

const BorrowEvmSignablePayloadInput = Schema.Union([
  BorrowEvmSignablePayload,
  Schema.fromJsonString(BorrowEvmSignablePayload),
]);

const decodeBorrowEvmSignablePayload = Schema.decodeUnknownEffect(
  BorrowEvmSignablePayloadInput
);

const normalizeNumberish = (
  value: bigint | number | string | undefined,
  fallback = "0"
) => (value == null ? fallback : value.toString());

const numberishToNumber = (
  value: bigint | number | string | undefined,
  fallback: bigint | number | string = 0
) => Number(value == null ? fallback : value);

const stringifyBorrowUnsignedEvmTransaction = ({
  fallbackChainId,
  payload,
}: {
  readonly fallbackChainId: number | string;
  readonly payload: BorrowEvmSignablePayload;
}) =>
  JSON.stringify({
    chainId: numberishToNumber(payload.chainId, fallbackChainId),
    data: payload.data,
    from: payload.from,
    gasLimit: normalizeNumberish(payload.gasLimit),
    nonce: numberishToNumber(payload.nonce),
    to: payload.to,
    type: numberishToNumber(payload.type),
    value: normalizeNumberish(payload.value),
  });

export const decodeBorrowEvmTransactionForWallet = Effect.fn(
  "decodeBorrowEvmTransactionForWallet"
)(function* ({
  action,
  transaction,
}: {
  readonly action: Action;
  readonly transaction: Transaction;
}): Effect.fn.Return<string, BorrowPayloadDecodeError> {
  const payload = yield* decodeBorrowEvmSignablePayload(
    transaction.signablePayload
  ).pipe(
    Effect.mapError(
      (cause) =>
        new BorrowPayloadDecodeError({
          actionId: action.id,
          cause,
          message: "Borrow transaction payload could not be decoded.",
          phase: "signing",
          transactionId: transaction.id,
        })
    )
  );

  return stringifyBorrowUnsignedEvmTransaction({
    fallbackChainId: transaction.chainId,
    payload,
  });
});

const getActionAmount = (action: Action) =>
  action.rawArguments?.amount ??
  action.rawArguments?.borrowAmount ??
  action.rawArguments?.amountRaw ??
  "0";

export const getBorrowTransactionMeta = ({
  action,
  transaction,
}: {
  readonly action: Action;
  readonly transaction: Transaction;
}) =>
  ({
    actionId: action.id,
    actionType: action.action,
    address: action.address,
    amount: getActionAmount(action).toString(),
    amountRaw: action.rawArguments?.amountRaw?.toString(),
    inputToken: undefined,
    providersDetails: [],
    rawArguments: action.rawArguments,
    txId: transaction.id,
    txType: transaction.type,
    yieldId: action.integrationId,
  }) as unknown as SKTxMeta;

export const getBorrowTransactionSubmitPayload = (
  signedTransaction: BorrowSignedTransaction
): SubmitTransactionCommand =>
  signedTransaction.broadcasted
    ? { transactionHash: signedTransaction.signedTx }
    : { signedPayload: signedTransaction.signedTx };

export const getBorrowSubmittedTransaction = ({
  response,
  signedTransaction,
  transaction,
}: {
  readonly response: SubmitTransactionResult;
  readonly signedTransaction: BorrowSignedTransaction;
  readonly transaction: Transaction;
}): BorrowSubmittedTransaction => ({
  hash: signedTransaction.broadcasted
    ? signedTransaction.signedTx
    : (response.transactionHash ?? signedTransaction.signedTx),
  link: response.link,
  signedPayload: signedTransaction.broadcasted
    ? undefined
    : signedTransaction.signedTx,
  status: response.status,
  transaction,
});
