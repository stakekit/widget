import { Effect, Match } from "effect";
import {
  type Action as BorrowAction,
  decodeBorrowTransactionForWallet,
} from "../../../domain/borrow";
import type { Network } from "../../../domain/schema/network-model";
import type { SKTxMeta } from "../../../public-api/types";
import { sameWalletScopeOwner } from "../../wallet/domain/scope";
import {
  TransactionSignError,
  type TransactionWorkflowContext,
  updateCurrentTransactionWorkflowTransaction,
} from "../transaction-workflow-model";
import { TransactionWorkflowOperationsService } from "../transaction-workflow-operations-service";
import { type CurrentWorkflow, requireCurrentWorkflow } from "./current";

const getWalletCustomMessage = (error: unknown): string | null =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "WalletBroadcastError" &&
  "customMessage" in error &&
  typeof error.customMessage === "string"
    ? error.customMessage
    : null;

const validateWallet = Effect.fn("TransactionWorkflow.validateWallet")(
  function* ({
    current,
    network,
  }: {
    readonly current: CurrentWorkflow;
    readonly network: string;
  }) {
    const operations = yield* TransactionWorkflowOperationsService;
    const { batch, transaction, workflowId } = current;
    const expectedAddress = Match.value(current).pipe(
      Match.tag("Classic", ({ domain }) => domain.actionMeta.address),
      Match.tag("Borrow", ({ domain }) => domain.action.address),
      Match.exhaustive
    );
    const error = (message: string, cause?: unknown) =>
      new TransactionSignError({
        batchId: batch.id,
        cause,
        customMessage: null,
        message,
        network,
        transactionId: transaction.source.transaction.id,
        workflowId,
      });
    const wallet = yield* operations.getWalletState.pipe(
      Effect.mapError((cause) =>
        error("Wallet state is unavailable for transaction signing.", cause)
      )
    );

    if (wallet.status !== "connected") {
      return yield* error("Wallet is not connected for transaction signing.");
    }

    if (!expectedAddress) {
      return yield* error("The transaction workflow has no wallet address.");
    }

    if (wallet.network !== network) {
      return yield* error(
        "Wallet network changed during transaction execution."
      );
    }

    if (
      !sameWalletScopeOwner(
        { address: wallet.address, network: wallet.network },
        { address: expectedAddress, network: wallet.network }
      )
    ) {
      return yield* error(
        "Wallet account changed during transaction execution."
      );
    }
  }
);

const getBorrowActionAmount = (action: BorrowAction) =>
  action.rawArguments?.amount ?? action.rawArguments?.amountRaw ?? 0;

const getBorrowTransactionMeta = ({
  action,
  transaction,
}: {
  readonly action: BorrowAction;
  readonly transaction: BorrowAction["transactions"][number];
}) =>
  ({
    actionId: action.id,
    actionType: action.action,
    address: action.address,
    amount: getBorrowActionAmount(action).toString(),
    amountRaw: action.rawArguments?.amountRaw?.toString(),
    inputToken: undefined,
    providersDetails: [],
    rawArguments: action.rawArguments,
    txId: transaction.id,
    txType: transaction.type,
    yieldId: action.integrationId,
  }) as SKTxMeta;

export const prepareAndSign = Effect.fn("TransactionWorkflow.prepareAndSign")(
  function* (context: TransactionWorkflowContext) {
    const operations = yield* TransactionWorkflowOperationsService;
    const current = yield* requireCurrentWorkflow(context);
    const { batch, transaction, workflowId } = current;
    const { source } = transaction;
    const network = source.transaction.network;
    const fail = (message: string, cause?: unknown) =>
      new TransactionSignError({
        batchId: batch.id,
        cause,
        customMessage: getWalletCustomMessage(cause),
        message,
        network,
        transactionId: source.transaction.id,
        workflowId,
      });

    yield* validateWallet({ current, network });

    const signed = yield* Match.value(current).pipe(
      Match.tag("Classic", ({ domain, transaction }) => {
        const { source } = transaction;

        if (source.transaction.unsignedTransaction == null) {
          return Effect.fail(fail("The transaction has no unsigned payload."));
        }

        const payload =
          typeof source.transaction.unsignedTransaction === "string"
            ? source.transaction.unsignedTransaction
            : JSON.stringify(source.transaction.unsignedTransaction);

        return source.transaction.isMessage
          ? operations.signMessage({ message: payload }).pipe(
              Effect.map((signedTx) => ({
                broadcasted: false as const,
                signedTx,
              })),
              Effect.mapError((cause) => fail("Message signing failed.", cause))
            )
          : operations
              .signTransaction({
                ledgerHwAppId: null,
                network: network as Network,
                tx: payload,
                txMeta: {
                  ...domain.actionMeta,
                  annotatedTransaction: source.transaction.annotatedTransaction,
                  gasEstimate: source.transaction.gasEstimate,
                  structuredTransaction:
                    source.transaction.structuredTransaction,
                  txId: source.transaction.id,
                  txType: source.transaction.type,
                },
              })
              .pipe(
                Effect.mapError((cause) =>
                  fail("Transaction signing failed.", cause)
                )
              );
      }),
      Match.tag("Borrow", ({ domain, transaction }) => {
        const { source } = transaction;

        return decodeBorrowTransactionForWallet(source.transaction).pipe(
          Effect.mapError((cause) =>
            fail("Borrow transaction payload could not be decoded.", cause)
          ),
          Effect.flatMap((tx) =>
            operations
              .signTransaction({
                ledgerHwAppId: null,
                network: network as Network,
                tx,
                txMeta: getBorrowTransactionMeta({
                  action: domain.action,
                  transaction: source.transaction,
                }),
              })
              .pipe(
                Effect.mapError((cause) =>
                  fail("Transaction signing failed.", cause)
                )
              )
          )
        );
      }),
      Match.exhaustive
    );

    const yieldId = Match.value(current).pipe(
      Match.tag("Classic", ({ domain }) => domain.yieldId),
      Match.tag("Borrow", ({ domain }) => domain.action.integrationId),
      Match.exhaustive
    );

    yield* operations.trackEvent("txSigned", {
      network,
      txId: source.transaction.id,
      yieldId,
    });

    return updateCurrentTransactionWorkflowTransaction({
      context,
      update: (current) => ({
        ...current,
        meta: {
          ...current.meta,
          broadcasted: signed.broadcasted,
          confirmationError: null,
          signError: null,
          signedTx: signed.signedTx,
        },
      }),
    });
  }
);
