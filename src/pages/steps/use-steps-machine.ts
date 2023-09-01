import { EitherAsync, Left, Right } from "purify-ts";
import useStateMachine, { t } from "@cassiozen/usestatemachine";
import { $$t } from "@cassiozen/usestatemachine/dist/types";
import {
  GetStakeSessionError,
  MissingHashError,
  SendTransactionError,
  SignError,
  SubmitError,
  SubmitHashError,
  TransactionConstructError,
} from "./errors";
import { Override } from "../../types/utils";
import {
  stakeGetStakeSession,
  transactionConstruct,
  transactionGetTransactionStatusFromId,
  transactionSubmit,
  transactionSubmitHash,
} from "@stakekit/api-hooks";
import { useSKWallet } from "../../hooks/wallet/use-sk-wallet";
import { getValidStakeSessionTx, isTxError } from "../../domain";
import { getAverageGasMode } from "../../api/get-gas-mode-value";
import { useInvalidateBalances } from "../../hooks/use-positions-data";
import { useInvalidateTokenAvailableAmount } from "../../hooks/api/use-token-available-amount";
import { withRequestErrorRetry } from "../../api/utils";

const tt = t as <T extends unknown>() => {
  [$$t]: T;
};

export const useStepsMachine = () => {
  const { signTransaction, isLedgerLive } = useSKWallet();

  const invalidateBalances = useInvalidateBalances();
  const invalidateTokenAvailableAmount = useInvalidateTokenAvailableAmount();

  return useStateMachine({
    initial: "idle",
    schema: {
      context: tt<{
        sessionId: string | null;
        signError:
          | Error
          | GetStakeSessionError
          | SendTransactionError
          | SignError
          | null;
        txCheckError: GetStakeSessionError | null;
        txCheckTimeoutId: number | null;
        txs: { signedTx: string; broadcasted: boolean; txId: string }[] | null;
        urls: string[];
      }>(),
      events: {
        START: tt<{ id: string }>(),
        SIGN_RETRY: tt<{ id: string }>(),
      },
    },
    context: {
      sessionId: null,
      signError: null,
      txCheckError: null,
      txCheckTimeoutId: null,
      txs: null,
      urls: [],
    },
    states: {
      idle: {
        on: { START: "signLoading" },
      },
      signLoading: {
        on: { SIGN_SUCCESS: "broadcastLoading", SIGN_ERROR: "signError" },
        effect: ({ send, setContext, event }) => {
          const id = event.id;

          setContext((ctx) => ({ ...ctx, sessionId: id }));

          withRequestErrorRetry({ fn: () => stakeGetStakeSession(id) })
            .mapLeft(() => new GetStakeSessionError())
            .chain((val) => EitherAsync.liftEither(getValidStakeSessionTx(val)))
            .chain((val) =>
              EitherAsync.sequence(
                val.transactions
                  .filter(
                    (
                      tx
                    ): tx is Override<
                      typeof tx,
                      { unsignedTransaction: string }
                    > => !!tx.unsignedTransaction
                  )
                  .map((tx, i) =>
                    getAverageGasMode(tx.network)
                      .chainLeft(async () => Right(null))
                      .chain((gas) =>
                        withRequestErrorRetry({
                          fn: () =>
                            transactionConstruct(tx.id, {
                              gasArgs: gas?.gasArgs,
                              // @ts-expect-error
                              ledgerWalletAPICompatible: isLedgerLive,
                            }),
                        }).mapLeft(() => new TransactionConstructError())
                      )
                      .chain((tx) => {
                        if (!tx.unsignedTransaction) {
                          return EitherAsync.liftEither(
                            Left(new TransactionConstructError())
                          );
                        }

                        return signTransaction({
                          tx: tx.unsignedTransaction,
                          index: i,
                        }).map((val) => ({ ...val, txId: tx.id }));
                      })
                  )
              )
            )
            .caseOf({
              Left: (l) => {
                console.log(l);
                setContext((ctx) => ({ ...ctx, signError: l }));
                send("SIGN_ERROR");
              },
              Right: (val) => {
                setContext((ctx) => ({ ...ctx, txs: val }));
                send({ type: "SIGN_SUCCESS" });
              },
            });
        },
      },
      signError: {
        on: { SIGN_RETRY: "signLoading" },
      },

      broadcastLoading: {
        on: {
          BROADCAST_SUCCESS: "txCheckLoading",
          BROADCAST_ERROR: "broadcastError",
        },
        effect: ({ send, context }) => {
          EitherAsync.liftEither(
            context.txs ? Right(context.txs) : Left(new Error("missing txs"))
          )
            .chain((txs) =>
              EitherAsync.sequence(
                txs.map((tx) => {
                  if (tx.broadcasted) {
                    return withRequestErrorRetry({
                      fn: () =>
                        transactionSubmitHash(tx.txId, { hash: tx.signedTx }),
                    }).mapLeft(() => new SubmitHashError());
                  } else {
                    return withRequestErrorRetry({
                      fn: async () => {
                        await transactionSubmit(tx.txId, {
                          signedTransaction: tx.signedTx,
                        });
                      },
                    }).mapLeft(() => new SubmitError());
                  }
                })
              )
            )
            .caseOf({
              Left: (l) => {
                console.log(l);
                send({ type: "BROADCAST_ERROR" });
              },
              Right: () => {
                send({ type: "BROADCAST_SUCCESS" });
              },
            });
        },
      },
      broadcastError: {
        on: { BROADCAST_RETRY: "broadcastLoading" },
      },

      txCheckLoading: {
        on: {
          TX_CHECK_SUCCESS: "done",
          TX_CHECK_ERROR: "txCheckError",
          TX_CHECK_RETRY: "txCheckRetry",
        },
        effect: ({ send, context, setContext }) => {
          EitherAsync.liftEither(
            context.sessionId
              ? Right(context.sessionId)
              : Left(new Error("missing sessionId"))
          )
            .chain((sessionId) =>
              withRequestErrorRetry({
                fn: () => stakeGetStakeSession(sessionId),
              })
                .mapLeft(() => new GetStakeSessionError())
                .chain((val) =>
                  EitherAsync.liftEither(getValidStakeSessionTx(val))
                )
                .chain((val) =>
                  EitherAsync.sequence(
                    val.transactions.map((tx) =>
                      withRequestErrorRetry({
                        fn: () => transactionGetTransactionStatusFromId(tx.id),
                      })
                        .mapLeft(() => new MissingHashError())
                        .chain((result) =>
                          EitherAsync.liftEither(
                            isTxError(result)
                              ? Left(new SignError())
                              : Right({
                                  result,
                                  isConfirmed: result.status === "CONFIRMED",
                                })
                          )
                        )
                    )
                  )
                )
            )
            .caseOf({
              Left: (l) => {
                console.log(l);
                setContext((ctx) => ({ ...ctx, txCheckError: l }));
                send("TX_CHECK_ERROR");
              },
              Right: (v) => {
                if (v.every((val) => val.isConfirmed)) {
                  invalidateBalances();
                  invalidateTokenAvailableAmount();

                  setContext((ctx) => ({
                    ...ctx,
                    urls: v.map((val) => val.result.url),
                  }));
                  send("TX_CHECK_SUCCESS");
                } else {
                  send({ type: "TX_CHECK_RETRY" });
                }
              },
            });
        },
      },
      txCheckRetry: {
        on: { TX_CHECK_RETRY: "txCheckLoading" },
        effect: ({ send, setContext }) => {
          const timeoutHandler = setTimeout(() => {
            send({ type: "TX_CHECK_RETRY" });
          }, 4000);

          setContext((ctx) => ({
            ...ctx,
            txCheckTimeoutId: timeoutHandler as unknown as number,
          }));
        },
      },
      txCheckError: {
        on: { TX_CHECK_RETRY: "txCheckLoading" },
      },
      done: {},
    },
  });
};
