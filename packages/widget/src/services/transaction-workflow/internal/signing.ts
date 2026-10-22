import { Effect, Match } from "effect";
import type { Action as BorrowAction } from "../../../domain/borrow/execution/action";
import {
  decodeBorrowTransactionForWallet,
  decodeBorrowTypedDataForWallet,
} from "../../../domain/borrow/execution/transaction";
import { TransactionId } from "../../../domain/identity/identifiers";
import type { Network } from "../../../domain/network/network";
import type { WalletScopeOwner } from "../../../domain/wallet/wallet-scope";
import { EvmRpc } from "../../evm-rpc/evm-rpc";
import { TrackingService } from "../../tracking/tracking-service";
import type {
  WalletOwnerMismatchError,
  WalletRuntimeInvariantError,
} from "../../wallet/wallet-errors";
import { WalletService } from "../../wallet/wallet-service";
import type { BorrowTransactionMeta } from "../../wallet/wallet-transactions";
import {
  type DirectTransactionLedger,
  makeTransactionSignError,
  type TransactionSignFailureReason,
  type TransactionSignWalletOperationCause,
  type TransactionWorkflowContext,
} from "../transaction-workflow-model";
import {
  getCurrentWorkflowTrackingYieldId,
  requireCurrentWorkflow,
} from "./current";
import { recordDirectTransaction } from "./ledger";
import { updateCurrentTransactionWorkflowTransaction } from "./model";

type WalletSignFailure =
  | TransactionSignWalletOperationCause
  | WalletOwnerMismatchError
  | WalletRuntimeInvariantError;

const walletSignFailureReason = (
  cause: WalletSignFailure,
  operation: "message" | "transaction" | "typed-data"
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
    WalletRequestCancelledError: ({ operation }) => ({
      _tag: "WalletRequestCancelled" as const,
      operation,
    }),
    WalletOwnerMismatchError: ({ reason }) => ({
      _tag: "WalletUnavailable" as const,
      detail: reason,
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

export const makePrepareAndSign = Effect.gen(function* () {
  const [evmRpc, tracking, wallet] = yield* Effect.all([
    EvmRpc,
    TrackingService,
    WalletService,
  ]);

  const getBorrowTransactionMeta = ({
    action,
    transaction,
  }: {
    readonly action: BorrowAction;
    readonly transaction: BorrowAction["transactions"][number];
  }): BorrowTransactionMeta | null => {
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
          : { amount: rawArguments.amount.toFixed() }),
        ...(rawArguments.amountRaw == null
          ? {}
          : { amountRaw: rawArguments.amountRaw.toString() }),
        ...(rawArguments.borrowAmount == null
          ? {}
          : { borrowAmount: rawArguments.borrowAmount }),
        ...(rawArguments.collateralAmount == null
          ? {}
          : { collateralAmount: rawArguments.collateralAmount.toFixed() }),
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

  return Effect.fn("TransactionWorkflow.prepareAndSign")(function* ({
    context,
    expectedOwner,
    ledger,
  }: {
    readonly context: TransactionWorkflowContext;
    /** The workflow's Wallet Scope Owner; the wallet signs only for it. */
    readonly expectedOwner: WalletScopeOwner;
    readonly ledger: DirectTransactionLedger;
  }) {
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

    const signed = yield* Match.value(current).pipe(
      Match.tag("Direct", ({ domain, transaction }) => {
        const direct = transaction.source.transaction;

        return evmRpc
          .prepare({
            chainId: direct.chainId,
            data: direct.data,
            from: expectedOwner.address as `0x${string}`,
            to: direct.to,
          })
          .pipe(
            Effect.mapError((cause) => fail({ _tag: "EstimateFailed", cause })),
            Effect.flatMap((tx) =>
              // A hash the wallet broadcast must reach the Ledger, even if the
              // workflow ends meanwhile.
              Effect.uninterruptibleMask((restore) =>
                restore(
                  wallet
                    .signTransaction({
                      expectedOwner,
                      family: "classic",
                      ledgerHwAppId: null,
                      network: direct.network,
                      tx,
                      txMeta: {
                        ...domain.actionMeta,
                        annotatedTransaction: null,
                        gasEstimate: undefined,
                        structuredTransaction: null,
                        txId: TransactionId.make(direct.id),
                        // The wallet labels a reset as the approval it is.
                        txType: direct.type === "WRAP" ? "WRAP" : "APPROVAL",
                      },
                    })
                    .pipe(
                      Effect.mapError((cause) =>
                        fail(walletSignFailureReason(cause, "transaction"))
                      )
                    )
                ).pipe(
                  Effect.tap((signed) =>
                    signed.broadcasted
                      ? recordDirectTransaction(ledger, direct, {
                          _tag: "Sent",
                          hash: signed.signedTx as `0x${string}`,
                        })
                      : Effect.void
                  )
                )
              )
            )
          );
      }),
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
          ? wallet.signMessage({ expectedOwner, message: payload }).pipe(
              Effect.map((signedTx) => ({
                broadcasted: false as const,
                signedTx,
              })),
              Effect.mapError((cause) =>
                fail(walletSignFailureReason(cause, "message"))
              )
            )
          : wallet
              .signTransaction({
                expectedOwner,
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
        const signingFormat = source.transaction.signingFormat;
        if (
          signingFormat !== undefined &&
          signingFormat !== "EVM_TRANSACTION" &&
          signingFormat !== "EIP712_TYPED_DATA"
        ) {
          return Effect.fail(
            fail({ _tag: "UnsupportedBorrowSigningFormat", signingFormat })
          );
        }

        const txMeta = getBorrowTransactionMeta({
          action: domain.action,
          transaction: source.transaction,
        });

        if (!txMeta) {
          return Effect.fail(fail({ _tag: "MissingBorrowMeta" }));
        }

        if (signingFormat === "EIP712_TYPED_DATA") {
          return decodeBorrowTypedDataForWallet(source.transaction).pipe(
            Effect.mapError((cause) => fail({ _tag: "DecodeFailed", cause })),
            Effect.flatMap((typedData) =>
              wallet.signTypedData({ expectedOwner, txMeta, typedData }).pipe(
                Effect.map((signedTx) => ({
                  broadcasted: false as const,
                  signedTx,
                })),
                Effect.mapError((cause) =>
                  fail(walletSignFailureReason(cause, "typed-data"))
                )
              )
            )
          );
        }

        return decodeBorrowTransactionForWallet(source.transaction).pipe(
          Effect.mapError((cause) => fail({ _tag: "DecodeFailed", cause })),
          Effect.flatMap((tx) =>
            wallet
              .signTransaction({
                expectedOwner,
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

    yield* tracking.trackEvent("txSigned", {
      network,
      txId: source.transaction.id,
      yieldId: getCurrentWorkflowTrackingYieldId(current),
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
  });
});
