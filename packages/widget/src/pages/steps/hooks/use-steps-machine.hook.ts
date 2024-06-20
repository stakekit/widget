import useStateMachine, { t } from "@cassiozen/usestatemachine";
import type { $$t } from "@cassiozen/usestatemachine/dist/types";
import type { ActionDto, TransactionDto } from "@stakekit/api-hooks";
import {
  useTransactionConstructHook,
  useTransactionGetGasForNetworkHook,
  useTransactionGetTransactionHook,
  useTransactionGetTransactionStatusFromIdHook,
  useTransactionSubmitHashHook,
  useTransactionSubmitHook,
} from "@stakekit/api-hooks";
import { isAxiosError } from "axios";
import { EitherAsync, Left, List, Maybe, Right } from "purify-ts";
import { useMemo } from "react";
import { getAverageGasMode } from "../../../common/get-gas-mode-value";
import { withRequestErrorRetry } from "../../../common/utils";
import {
  getTransactionsForMultiSign,
  isTxError,
  transactionsForConstructOnlySet,
} from "../../../domain";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { isExternalProviderConnector } from "../../../providers/external-provider";
import { useSKWallet } from "../../../providers/sk-wallet";
import type { GetStakeSessionError, SendTransactionError } from "./errors";
import {
  SignError,
  SubmitError,
  SubmitHashError,
  TXCheckError,
  TransactionConstructError,
} from "./errors";

const tt = t as <T>() => {
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

type SignRes =
  | { type: "broadcasted" }
  | {
      type: "regular";
      data: {
        signedTx: string;
        broadcasted: boolean;
      };
    };

const throwIfUnmounted = (
  stepsPageUnmounted: React.MutableRefObject<boolean>
) => {
  if (stepsPageUnmounted.current) {
    throw new Error("User cancelled.");
  }
};

export const useStepsMachine = (
  session: ActionDto | null,
  stepsPageUnmounted: React.MutableRefObject<boolean>
) => {
  const {
    signTransaction,
    signMultipleTransactions,
    signMessage,
    connector,
    isLedgerLive,
  } = useSKWallet();

  const trackEvent = useTrackEvent();

  const transactionSubmit = useTransactionSubmitHook();
  const transactionGetTransactionStatusFromId =
    useTransactionGetTransactionStatusFromIdHook();
  const transactionGetTransaction = useTransactionGetTransactionHook();
  const transactionSubmitHash = useTransactionSubmitHashHook();
  const transactionGetGasForNetwork = useTransactionGetGasForNetworkHook();
  const transactionConstruct = useTransactionConstructHook();

  const shouldMultiSend = useMemo(
    () =>
      connector &&
      isExternalProviderConnector(connector) &&
      connector.shouldMultiSend,
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

    if (!txs.length) return def;

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

    const currentTxIdx = 0;

    const currentTxMeta = {
      idx: currentTxIdx,
      id: txs[currentTxIdx].id,
    };

    return {
      enabled: true,
      txStates: shouldMultiSend ? [txStates[currentTxIdx]] : txStates,
      currentTxMeta,
      yieldId: session.integrationId,
    };
  }, [session, shouldMultiSend]);

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
          BROADCAST_SUCCESS: "txCheckLoading",
          DONE: "done",
        },
        effect: ({ context, send, setContext }) => {
          throwIfUnmounted(stepsPageUnmounted);
          EitherAsync.liftEither(
            Maybe.fromNullable(
              context.txStates[context.currentTxMeta?.idx!].tx
            ).toEither(new Error("missing tx"))
          )
            .chain<Error, SignRes>((tx) => {
              /**
               * Multi sign transactions
               */
              if (shouldMultiSend) {
                return EitherAsync.liftEither(
                  Maybe.fromNullable(session?.transactions).toEither(
                    new Error("missing session")
                  )
                )
                  .chain((txs) =>
                    EitherAsync.liftEither(
                      Right(
                        txs.find((tx) =>
                          transactionsForConstructOnlySet.has(tx.type)
                        )
                      )
                    ).chain((constructOnlyTx) => {
                      if (!constructOnlyTx) {
                        return EitherAsync.liftEither(
                          Right(getTransactionsForMultiSign(txs))
                        );
                      }

                      throwIfUnmounted(stepsPageUnmounted);
                      return getAverageGasMode({
                        network: constructOnlyTx.network,
                        transactionGetGasForNetwork,
                      })
                        .chainLeft(async () => Right(null))
                        .chain((gas) => {
                          throwIfUnmounted(stepsPageUnmounted);
                          return withRequestErrorRetry({
                            fn: () =>
                              transactionConstruct(constructOnlyTx.id, {
                                gasArgs: gas?.gasArgs,
                                ledgerWalletAPICompatible: isLedgerLive,
                              }),
                          }).mapLeft(() => new TransactionConstructError());
                        })
                        .chain(() => {
                          throwIfUnmounted(stepsPageUnmounted);
                          return withRequestErrorRetry({
                            fn: () =>
                              transactionGetTransactionStatusFromId(
                                constructOnlyTx.id
                              ),
                            retryTimes: 10,
                            retryWaitForMs() {
                              return 5000;
                            },
                          }).mapLeft(
                            () =>
                              new Error(
                                `failed to get ${constructOnlyTx.id} tx status`
                              )
                          );
                        })
                        .map(() => getTransactionsForMultiSign(txs));
                    })
                  )
                  .chain((txs) => {
                    throwIfUnmounted(stepsPageUnmounted);
                    return getAverageGasMode({
                      network: tx.network,
                      transactionGetGasForNetwork,
                    }).chain((gas) => {
                      throwIfUnmounted(stepsPageUnmounted);
                      return EitherAsync.sequence(
                        txs.map((tx) =>
                          withRequestErrorRetry({
                            fn: () =>
                              transactionConstruct(tx.id, {
                                gasArgs: gas?.gasArgs,
                                ledgerWalletAPICompatible: isLedgerLive,
                              }),
                          }).mapLeft(() => new TransactionConstructError())
                        )
                      );
                    });
                  })
                  .map((txs) =>
                    txs
                      .map((tx) => tx.unsignedTransaction)
                      .filter((tx): tx is NonNullable<typeof tx> => !!tx)
                  )
                  .chain((txs) => {
                    if (!txs.length) {
                      return EitherAsync.liftEither(
                        Left(new TransactionConstructError())
                      );
                    }

                    throwIfUnmounted(stepsPageUnmounted);
                    return signMultipleTransactions({ txs });
                  })
                  .map((val) => ({ type: "regular", data: val }));
              }

              /**
               * Single sign transactions
               */
              return getAverageGasMode({
                network: tx.network,
                transactionGetGasForNetwork,
              })
                .chainLeft(async () => Right(null))
                .chain((gas) => {
                  throwIfUnmounted(stepsPageUnmounted);
                  return withRequestErrorRetry({
                    fn: () =>
                      transactionConstruct(tx.id, {
                        gasArgs: gas?.gasArgs,
                        ledgerWalletAPICompatible: isLedgerLive,
                      }),
                  }).mapLeft(() => new TransactionConstructError());
                })
                .chain((constructedTx) => {
                  if (constructedTx.status === "BROADCASTED") {
                    return EitherAsync.liftEither(
                      Right({ type: "broadcasted" })
                    );
                  }

                  if (!constructedTx.unsignedTransaction) {
                    return EitherAsync.liftEither(
                      Left(new TransactionConstructError())
                    );
                  }

                  if (constructedTx.isMessage) {
                    return signMessage(constructedTx.unsignedTransaction).map(
                      (val) => ({
                        type: "regular",
                        data: { signedTx: val, broadcasted: false },
                      })
                    );
                  }

                  throwIfUnmounted(stepsPageUnmounted);
                  return signTransaction({
                    tx: constructedTx.unsignedTransaction,
                    ledgerHwAppId: constructedTx.ledgerHwAppId,
                  })
                    .map((val) => ({
                      ...val,
                      network: constructedTx.network,
                      txId: constructedTx.id,
                    }))
                    .ifRight(() => {
                      throwIfUnmounted(stepsPageUnmounted);
                      return trackEvent("txSigned", {
                        txId: constructedTx.id,
                        network: constructedTx.network,
                        yieldId: context.yieldId,
                      });
                    })
                    .map((val) => ({ type: "regular", data: val }));
                });
            })
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
                if (tx.type === "broadcasted") return send("BROADCAST_SUCCESS");

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
                            broadcasted: tx.data.broadcasted,
                            signedTx: tx.data.signedTx,
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
          throwIfUnmounted(stepsPageUnmounted);
          EitherAsync.liftEither(
            Maybe.fromNullable(
              context.txStates[context.currentTxMeta?.idx!]
            ).toEither(new Error("missing tx"))
          )
            .chain((currentTx) => {
              throwIfUnmounted(stepsPageUnmounted);
              if (currentTx.meta.broadcasted) {
                return withRequestErrorRetry({
                  fn: () =>
                    transactionSubmitHash(currentTx.tx.id, {
                      hash: currentTx.meta.signedTx!,
                    }),
                })
                  .mapLeft(() => new SubmitHashError())
                  .ifRight(() => {
                    throwIfUnmounted(stepsPageUnmounted);
                    trackEvent("txSubmitted", {
                      txId: currentTx.tx.id,
                      network: currentTx.tx.network,
                      yieldId: context.yieldId,
                    });
                  });
              }
              return withRequestErrorRetry({
                fn: async () => {
                  await transactionSubmit(currentTx.tx.id, {
                    signedTransaction: currentTx.meta.signedTx!,
                  });
                },
              })
                .mapLeft(() => new SubmitError())
                .ifRight(() => {
                  throwIfUnmounted(stepsPageUnmounted);
                  trackEvent("txSubmitted", {
                    txId: currentTx.tx.id,
                    network: currentTx.tx.network,
                    yieldId: context.yieldId,
                  });
                });
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
          throwIfUnmounted(stepsPageUnmounted);
          EitherAsync.liftEither(
            Maybe.fromNullable(
              context.txStates[context.currentTxMeta?.idx!]
            ).toEither(new Error("missing tx"))
          )
            .chain((currentTx) => {
              throwIfUnmounted(stepsPageUnmounted);
              return withRequestErrorRetry({
                fn: () =>
                  transactionGetTransactionStatusFromId(currentTx.tx.id),
                shouldRetry: (e, retryCount) =>
                  retryCount <= 3 &&
                  isAxiosError(e) &&
                  (e.response?.status === 404 || e.response?.status === 503),
              })
                .map((res) => ({ url: res.url, status: res.status }))
                .chainLeft(() => {
                  throwIfUnmounted(stepsPageUnmounted);
                  return withRequestErrorRetry({
                    fn: () => transactionGetTransaction(currentTx.tx.id),
                  }).map((res) => ({
                    url: res.explorerUrl,
                    status: res.status,
                  }));
                })
                .mapLeft(() => new TXCheckError())
                .chain((val) => {
                  throwIfUnmounted(stepsPageUnmounted);
                  return EitherAsync.liftEither(
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
                  );
                });
            })
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
                throwIfUnmounted(stepsPageUnmounted);
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
                    (val) => !val.meta.done,
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
                  }

                  send("SIGN_NEXT_TX");
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
