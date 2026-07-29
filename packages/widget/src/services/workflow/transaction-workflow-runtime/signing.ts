import { Effect, Match } from "effect";
import type { Action as BorrowAction } from "../../../domain/borrow/action";
import { decodeBorrowTransactionForWallet } from "../../../domain/borrow/transaction";
import type { Network } from "../../../domain/schema/network-model";
import type { SKBorrowTxMeta } from "../../../public-api/types";
import type { WalletRuntimeInvariantError } from "../../wallet/domain/errors";
import { sameWalletScopeOwner } from "../../wallet/domain/scope";
import {
  makeTransactionSignError,
  type TransactionSignFailureReason,
  type TransactionSignWalletOperationCause,
  type TransactionWorkflowContext,
  updateCurrentTransactionWorkflowTransaction,
} from "../transaction-workflow-model";
import { TransactionWorkflowOperationsService } from "../transaction-workflow-operations-service";
import { type CurrentWorkflow, requireCurrentWorkflow } from "./current";

type WalletSignFailure =
  | TransactionSignWalletOperationCause
  | WalletRuntimeInvariantError;

const walletSignFailureReason = (
  cause: WalletSignFailure,
  operation: "message" | "transaction"
): TransactionSignFailureReason =>
  Match.valueTags(cause, {
    WalletBroadcastError: (cause) => ({
      _tag: "WalletOperationFailed" as const,
      cause,
      operation,
    }),
    WalletCapabilityUnavailableError: (cause) => ({
      _tag: "WalletOperationFailed" as const,
      cause,
      operation,
    }),
    WalletDecodeError: (cause) => ({
      _tag: "WalletOperationFailed" as const,
      cause,
      operation,
    }),
    WalletRuntimeInvariantError: (cause) => ({
      _tag: "WalletUnavailable" as const,
      cause,
      detail: "state-unavailable" as const,
    }),
    WalletSigningError: (cause) => ({
      _tag: "WalletOperationFailed" as const,
      cause,
      operation,
    }),
  });

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
    const fail = (reason: TransactionSignFailureReason) =>
      makeTransactionSignError({
        batchId: batch.id,
        network,
        reason,
        transactionId: transaction.source.transaction.id,
        workflowId,
      });
    const wallet = yield* operations.getWalletState.pipe(
      Effect.mapError((cause) =>
        fail({
          _tag: "WalletUnavailable",
          cause,
          detail: "state-unavailable",
        })
      )
    );

    if (wallet.status !== "connected") {
      return yield* fail({
        _tag: "WalletUnavailable",
        detail: "disconnected",
      });
    }

    if (!expectedAddress) {
      return yield* fail({
        _tag: "WalletUnavailable",
        detail: "no-address",
      });
    }

    if (wallet.network !== network) {
      return yield* fail({
        _tag: "WalletUnavailable",
        detail: "network-changed",
      });
    }

    if (
      !sameWalletScopeOwner(
        { address: wallet.address, network: wallet.network },
        { address: expectedAddress, network: wallet.network }
      )
    ) {
      return yield* fail({
        _tag: "WalletUnavailable",
        detail: "account-changed",
      });
    }
  }
);

const getBorrowTransactionMeta = ({
  action,
  transaction,
}: {
  readonly action: BorrowAction;
  readonly transaction: BorrowAction["transactions"][number];
}): SKBorrowTxMeta | null => {
  const rawArguments = action.rawArguments;
  if (!rawArguments) return null;

  return {
    actionId: action.id,
    actionType: action.action,
    address: action.address,
    integrationId: action.integrationId,
    rawArguments: {
      marketId: rawArguments.marketId,
      ...(rawArguments.amount == null
        ? {}
        : { amount: rawArguments.amount.toString() }),
      ...(rawArguments.amountRaw == null
        ? {}
        : { amountRaw: rawArguments.amountRaw.toString() }),
      ...(rawArguments.borrowAmount == null
        ? {}
        : { borrowAmount: rawArguments.borrowAmount }),
      ...(rawArguments.collateralAmount == null
        ? {}
        : { collateralAmount: rawArguments.collateralAmount.toString() }),
      ...(rawArguments.collateralAmountRaw == null
        ? {}
        : {
            collateralAmountRaw: rawArguments.collateralAmountRaw.toString(),
          }),
      ...(rawArguments.collateralTokenAddress == null
        ? {}
        : {
            collateralTokenAddress: rawArguments.collateralTokenAddress,
          }),
      ...(rawArguments.repayAll == null
        ? {}
        : { repayAll: rawArguments.repayAll }),
      ...(rawArguments.targetLtv == null
        ? {}
        : { targetLtv: rawArguments.targetLtv }),
      ...(rawArguments.tokenAddress == null
        ? {}
        : { tokenAddress: rawArguments.tokenAddress }),
    },
    txId: transaction.id,
    txType: transaction.type,
  };
};

export const prepareAndSign = Effect.fn("TransactionWorkflow.prepareAndSign")(
  function* (context: TransactionWorkflowContext) {
    const operations = yield* TransactionWorkflowOperationsService;
    const current = yield* requireCurrentWorkflow(context);
    const { batch, transaction, workflowId } = current;
    const { source } = transaction;
    const network = source.transaction.network;
    const fail = (reason: TransactionSignFailureReason) =>
      makeTransactionSignError({
        batchId: batch.id,
        network,
        reason,
        transactionId: source.transaction.id,
        workflowId,
      });

    yield* validateWallet({ current, network });

    const signed = yield* Match.value(current).pipe(
      Match.tag("Classic", ({ domain, transaction }) => {
        const { source } = transaction;

        if (source.transaction.unsignedTransaction == null) {
          return Effect.fail(fail({ _tag: "MissingUnsignedPayload" }));
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
              Effect.mapError((cause) =>
                fail(walletSignFailureReason(cause, "message"))
              )
            )
          : operations
              .signTransaction({
                family: "classic",
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
                  fail(walletSignFailureReason(cause, "transaction"))
                )
              );
      }),
      Match.tag("Borrow", ({ domain, transaction }) => {
        const { source } = transaction;
        const txMeta = getBorrowTransactionMeta({
          action: domain.action,
          transaction: source.transaction,
        });

        if (!txMeta) {
          return Effect.fail(fail({ _tag: "MissingBorrowMeta" }));
        }

        return decodeBorrowTransactionForWallet(source.transaction).pipe(
          Effect.mapError((cause) => fail({ _tag: "DecodeFailed", cause })),
          Effect.flatMap((tx) =>
            operations
              .signTransaction({
                family: "borrow",
                ledgerHwAppId: null,
                network: network as Network,
                tx,
                txMeta,
              })
              .pipe(
                Effect.mapError((cause) =>
                  fail(walletSignFailureReason(cause, "transaction"))
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
