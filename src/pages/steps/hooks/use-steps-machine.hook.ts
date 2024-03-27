import { EitherAsync, Left, List, Maybe, Right } from "purify-ts";
import useStateMachine, { t } from "@cassiozen/usestatemachine";
import { $$t } from "@cassiozen/usestatemachine/dist/types";
import {
  GetStakeSessionError,
  TXCheckError,
  SendTransactionError,
  SignError,
  SubmitError,
  SubmitHashError,
  TransactionConstructError,
} from "./errors";
import {
  ActionDto,
  TransactionDto,
  transactionConstruct,
  transactionGetTransaction,
  transactionGetTransactionStatusFromId,
  transactionSubmit,
  transactionSubmitHash,
} from "@stakekit/api-hooks";
import { isTxError } from "../../../domain";
import { withRequestErrorRetry } from "../../../common/utils";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { isAxiosError } from "axios";
import { useMemo } from "react";
import { isExternalProviderConnector } from "../../../providers/sk-wallet/utils";
import { getAverageGasMode } from "../../../common/get-gas-mode-value";

const tt = t as <T extends unknown>() => {
  [$$t]: T;
};

type TxMeta = {
  url: string | null;
  signedTx: string | null;
  broadcasted: boolean | null;
  signError:
    | Error
    | GetStakeSessionError
    | SendTransactionError
    | SignError
    | null;
  txCheckError: GetStakeSessionError | null;
  done: boolean;
};

export type TxState = {
  tx: TransactionDto;
  meta: TxMeta;
};

export const useStepsMachine = (session: ActionDto | null) => {
  const { signTransaction, signMultipleTransactions, connector, isLedgerLive } =
    useSKWallet();

  const trackEvent = useTrackEvent();

  const shouldMultiSend = useMemo(
    () =>
      connector &&
      isExternalProviderConnector(connector) &&
      connector.provider.shouldMultiSend,
    [connector]
  );

  const initContext = useMemo(() => {
    const def = {
      enabled: false,
      txStates: null,
      currentTxMeta: null,
      yieldId: null,
    };

    if (!session?.transactions) return def;

    const txs = session.transactions;

    const currentTxIdx = List.findIndex(
      (val) => val.status === "WAITING_FOR_SIGNATURE",
      txs
    ).extractNullable();

    if (currentTxIdx === null) {
      return def;
    }

    const txStates = txs.map<TxState>((dto) => ({
      tx: dto,
      meta: {
        broadcasted: null,
        signedTx: null,
        url: null,
        signError: null,
        txCheckError: null,
        done: false,
      },
    }));

    const currentTxMeta = {
      idx: shouldMultiSend ? 0 : currentTxIdx,
      id: txs[currentTxIdx].id,
    };

    return {
      enabled: true,
      txStates: shouldMultiSend ? [txStates[currentTxIdx]] : txStates,
      currentTxMeta,
      yieldId: session.integrationId,
    };
  }, [session?.integrationId, session?.transactions, shouldMultiSend]);

  const stateMachine = useStateMachine({
    initial: initContext ? "idle" : "disabled",
    schema: {
      context: tt<{
        yieldId: string | null;
        txStates: TxState[];
        currentTxMeta: { idx: number; id: string } | null;
        txCheckTimeoutId: number | null;
      }>(),
    },
    context: {
      yieldId: initContext?.yieldId ?? null,
      txStates: initContext?.txStates ?? [],
      currentTxMeta: initContext?.currentTxMeta ?? null,
      txCheckTimeoutId: null,
    },
    states: {
      idle: {
        on: { START: "signLoading" },
      },
      disabled: {},
      signLoading: {
        on: {
          SIGN_SUCCESS: "broadcastLoading",
          SIGN_ERROR: "signError",
          DONE: "done",
        },
        effect: ({ context, send, setContext }) => {
          EitherAsync.liftEither(Right(!!shouldMultiSend))
            .chain((val) =>
              val
                ? EitherAsync.liftEither(
                    Maybe.fromNullable(session?.transactions)
                      .toEither(new Error("missing session"))
                      .map((txs) =>
                        txs
                          .map((tx) => tx.unsignedTransaction)
                          .filter((tx): tx is NonNullable<typeof tx> => !!tx)
                      )
                  ).chain((txs) => {
                    if (!txs.length) {
                      return EitherAsync.liftEither(
                        Left(new TransactionConstructError())
                      );
                    }

                    return signMultipleTransactions({ txs });
                  })
                : EitherAsync.liftEither(
                    Right(context.txStates[context.currentTxMeta?.idx!].tx)
                  )
                    .chain((tx) =>
                      getAverageGasMode(tx.network)
                        .chainLeft(async () => Right(null))
                        .chain((gas) =>
                          withRequestErrorRetry({
                            fn: () =>
                              transactionConstruct(tx.id, {
                                gasArgs: gas?.gasArgs,
                                ledgerWalletAPICompatible: isLedgerLive,
                              }),
                          }).mapLeft(() => new TransactionConstructError())
                        )
                    )
                    .chain((constructedTx) => {
                      if (!constructedTx.unsignedTransaction) {
                        return EitherAsync.liftEither(
                          Left(new TransactionConstructError())
                        );
                      }

                      return signTransaction({
                        tx: constructedTx.unsignedTransaction,
                        // @ts-expect-error
                        ledgerHwAppId: constructedTx.ledgerHwAppId,
                      })
                        .map((val) => ({
                          ...val,
                          network: constructedTx.network,
                          txId: constructedTx.id,
                        }))
                        .ifRight(() =>
                          trackEvent("txSigned", {
                            txId: constructedTx.id,
                            network: constructedTx.network,
                            yieldId: context.yieldId,
                          })
                        );
                    })
            )
            .caseOf({
              Left: (l) => {
                console.log(l);
                setContext((ctx) => ({
                  ...ctx,
                  txStates: ctx.txStates.map((val, i) =>
                    i === ctx.currentTxMeta?.idx!
                      ? {
                          ...val,
                          meta: {
                            ...val.meta,
                            txCheckError: null,
                            signError: l,
                          },
                        }
                      : val
                  ),
                }));
                send("SIGN_ERROR");
              },
              Right: (tx) => {
                setContext((ctx) => ({
                  ...ctx,
                  txStates: ctx.txStates.map((val, i) =>
                    i === ctx.currentTxMeta?.idx!
                      ? {
                          ...val,
                          meta: {
                            ...val.meta,
                            txCheckError: null,
                            signError: null,
                            broadcasted: tx.broadcasted,
                            signedTx: tx.signedTx,
                          },
                        }
                      : val
                  ),
                }));
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
        effect: ({ send, context, setContext }) => {
          EitherAsync.liftEither(
            Maybe.fromNullable(
              context.txStates[context.currentTxMeta?.idx!]
            ).toEither(new Error("missing tx"))
          )
            .chain((currentTx) => {
              if (currentTx.meta.broadcasted) {
                return withRequestErrorRetry({
                  fn: () =>
                    transactionSubmitHash(currentTx.tx.id, {
                      hash: currentTx.meta.signedTx!,
                    }),
                })
                  .mapLeft(() => new SubmitHashError())
                  .ifRight(() => {
                    trackEvent("txSubmitted", {
                      txId: currentTx.tx.id,
                      network: currentTx.tx.network,
                      yieldId: context.yieldId,
                    });
                  });
              } else {
                return withRequestErrorRetry({
                  fn: async () => {
                    await transactionSubmit(currentTx.tx.id, {
                      signedTransaction: currentTx.meta.signedTx!,
                    });
                  },
                })
                  .mapLeft(() => new SubmitError())
                  .ifRight(() => {
                    trackEvent("txSubmitted", {
                      txId: currentTx.tx.id,
                      network: currentTx.tx.network,
                      yieldId: context.yieldId,
                    });
                  });
              }
            })
            .caseOf({
              Left: (l) => {
                console.log(l);
                send({ type: "BROADCAST_ERROR" });

                setContext((ctx) => ({
                  ...ctx,
                  txStates: ctx.txStates.map((val, i) =>
                    i === ctx.currentTxMeta?.idx
                      ? {
                          ...val,
                          meta: {
                            ...val.meta,
                            txCheckError: null,
                            signError: null,
                          },
                        }
                      : val
                  ),
                }));
              },
              Right: () => {
                send({ type: "BROADCAST_SUCCESS" });

                setContext((ctx) => ({
                  ...ctx,
                  txStates: ctx.txStates.map((val, i) =>
                    i === ctx.currentTxMeta?.idx!
                      ? {
                          ...val,
                          meta: {
                            ...val.meta,
                            txCheckError: null,
                            signError: null,
                          },
                        }
                      : val
                  ),
                }));
              },
            });
        },
      },

      broadcastError: {
        on: { BROADCAST_RETRY: "broadcastLoading" },
      },

      txCheckLoading: {
        on: {
          SIGN_NEXT_TX: "signLoading",
          DONE: "done",
          TX_CHECK_ERROR: "txCheckError",
          TX_CHECK_RETRY: "txCheckRetry",
        },
        effect: ({ send, context, setContext }) => {
          EitherAsync.liftEither(
            Maybe.fromNullable(
              context.txStates[context.currentTxMeta?.idx!]
            ).toEither(new Error("missing tx"))
          )
            .chain((currentTx) =>
              withRequestErrorRetry({
                fn: () =>
                  transactionGetTransactionStatusFromId(currentTx.tx.id),
                shouldRetry: (e, retryCount) =>
                  retryCount <= 3 &&
                  isAxiosError(e) &&
                  (e.response?.status === 404 || e.response?.status === 503),
              })
                .map((res) => ({ url: res.url, status: res.status }))
                .chainLeft(() =>
                  withRequestErrorRetry({
                    fn: () => transactionGetTransaction(currentTx.tx.id),
                  }).map((res) => ({
                    url: res.explorerUrl,
                    status: res.status,
                  }))
                )
                .mapLeft(() => new TXCheckError())
                .chain((val) =>
                  EitherAsync.liftEither(
                    isTxError(val.status)
                      ? Left(
                          new SignError({
                            txId: currentTx.tx.id,
                            network: currentTx.tx.network,
                          })
                        )
                      : Right({
                          url: val.url,
                          isConfirmed: val.status === "CONFIRMED",
                        })
                  )
                )
            )
            .caseOf({
              Left: (l) => {
                console.log(l);

                if (l instanceof SignError) {
                  trackEvent("txNotConfirmed", {
                    txId: l.txId,
                    yieldId: context.yieldId,
                  });
                }

                setContext((ctx) => ({
                  ...ctx,
                  txStates: ctx.txStates.map((val, i) =>
                    i === ctx.currentTxMeta?.idx!
                      ? {
                          ...val,
                          meta: {
                            ...val.meta,
                            txCheckError: l,
                            signError: null,
                          },
                        }
                      : val
                  ),
                }));

                send("TX_CHECK_ERROR");
              },
              Right: (v) => {
                if (v.isConfirmed) {
                  const newTxStates = context.txStates.map((val, i) =>
                    i === context.currentTxMeta?.idx!
                      ? {
                          ...val,
                          meta: {
                            ...val.meta,
                            signError: null,
                            txCheckError: null,
                            url: v.url,
                            done: true,
                          },
                        }
                      : val
                  );

                  const newCurrentTxIdx = List.findIndex(
                    (val) =>
                      val.tx.status === "WAITING_FOR_SIGNATURE" &&
                      !val.meta.done,
                    newTxStates
                  ).extractNullable();

                  setContext((ctx) => ({
                    ...ctx,
                    currentTxMeta: newCurrentTxIdx
                      ? {
                          idx: newCurrentTxIdx,
                          id: newTxStates[newCurrentTxIdx]?.tx.id ?? null,
                        }
                      : null,
                    txStates: newTxStates,
                  }));

                  if (newCurrentTxIdx === null) {
                    return send("DONE");
                  } else {
                    send("SIGN_NEXT_TX");
                  }
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

  return stateMachine;
};
