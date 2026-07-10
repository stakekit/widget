import { Context, Data, Effect, Layer, PubSub, Schema, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { Networks } from "../../domain/types/chains/networks";
import type { SKWallet } from "../../domain/types/wallet";
import type { SKTxMeta } from "../../domain/types/wallets/generic-wallet";
import type {
  Action,
  SubmitTransactionCommand,
  SubmitTransactionResult,
  Transaction,
  WalletState,
} from "../domain";

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
  readonly network: Networks;
  readonly transaction: Transaction;
  readonly tx: string;
  readonly txMeta: SKTxMeta;
};

export type BorrowWalletExecutionAdapter = {
  readonly getState: () => WalletState;
  readonly signTransaction: (
    request: BorrowWalletSignRequest
  ) => Effect.Effect<BorrowSignedTransaction, BorrowTransactionExecutionError>;
};

export const disconnectedBorrowWalletState: WalletState = {
  status: "disconnected",
};

export const makeDisconnectedBorrowWalletExecutionAdapter =
  (): BorrowWalletExecutionAdapter => ({
    getState: () => disconnectedBorrowWalletState,
    signTransaction: (request) =>
      Effect.fail(
        new BorrowWalletDisconnectedError({
          actionId: request.action.id,
          message: "Wallet is disconnected.",
          phase: "signing",
          transactionId: request.transaction.id,
        })
      ),
  });

export const borrowWalletExecutionAdapterAtom =
  Atom.make<BorrowWalletExecutionAdapter>(
    makeDisconnectedBorrowWalletExecutionAdapter()
  ).pipe(Atom.withLabel("borrowWalletExecutionAdapterAtom"));

export class BorrowWalletExecutionService extends Context.Service<
  BorrowWalletExecutionService,
  BorrowWalletExecutionAdapter
>()("stakekit/widget/borrow/BorrowWalletExecutionService") {}

export const makeSKWalletBorrowExecutionAdapter = ({
  getState,
  signTransaction,
}: {
  readonly getState: () => WalletState;
  readonly signTransaction: SKWallet["signTransaction"];
}): BorrowWalletExecutionAdapter => ({
  getState,
  signTransaction: (request) => {
    const walletState = getState();

    if (walletState.status !== "connected") {
      return Effect.fail(
        new BorrowWalletDisconnectedError({
          actionId: request.action.id,
          message: "Wallet is disconnected.",
          phase: "signing",
          transactionId: request.transaction.id,
        })
      );
    }

    return Effect.tryPromise({
      try: () =>
        signTransaction({
          ledgerHwAppId: null,
          network: request.network,
          tx: request.tx,
          txMeta: request.txMeta,
        }).run(),
      catch: (cause) =>
        new BorrowSigningFailedError({
          actionId: request.action.id,
          cause,
          message: "Wallet signing failed.",
          phase: "signing",
          transactionId: request.transaction.id,
        }),
    }).pipe(
      Effect.flatMap((result) => {
        if (result.isLeft()) {
          return Effect.fail(
            new BorrowSigningFailedError({
              actionId: request.action.id,
              cause: result.extract(),
              message: "Wallet signing failed.",
              phase: "signing",
              transactionId: request.transaction.id,
            })
          );
        }

        return Effect.succeed(result.extract() as BorrowSignedTransaction);
      })
    );
  },
});

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

export class BorrowExecutionEventsService extends Context.Service<
  BorrowExecutionEventsService,
  {
    readonly events: Stream.Stream<BorrowExecutionEvent>;
    readonly publish: (event: BorrowExecutionEvent) => Effect.Effect<void>;
  }
>()("stakekit/widget/borrow/BorrowExecutionEventsService") {
  static readonly layer = Layer.effect(
    BorrowExecutionEventsService,
    Effect.gen(function* () {
      const pubsub = yield* PubSub.sliding<BorrowExecutionEvent>({
        capacity: 64,
        replay: BORROW_EXECUTION_EVENT_REPLAY_SIZE,
      });

      yield* Effect.addFinalizer(() => PubSub.shutdown(pubsub));

      return BorrowExecutionEventsService.of({
        events: Stream.fromPubSub(pubsub),
        publish: (event) => PubSub.publish(pubsub, event).pipe(Effect.asVoid),
      });
    })
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
