import { shouldMultiSend } from "@sk-widget/domain/types/connectors";
import { useSavedRef } from "@sk-widget/hooks";
import type { ActionDto, TransactionDto } from "@stakekit/api-hooks";
import {
  useTransactionConstructHook,
  useTransactionGetGasForNetworkHook,
  useTransactionGetTransactionHook,
  useTransactionGetTransactionStatusFromIdHook,
  useTransactionSubmitHashHook,
  useTransactionSubmitHook,
} from "@stakekit/api-hooks";
import { useMachine } from "@xstate/react";
import { isAxiosError } from "axios";
import { EitherAsync, Left, List, Maybe, Right } from "purify-ts";
import { type MutableRefObject, useMemo, useState } from "react";
import { assign, emit, setup } from "xstate";
import { getAverageGasMode } from "../../../common/get-gas-mode-value";
import { withRequestErrorRetry } from "../../../common/utils";
import {
  getTransactionsForMultiSign,
  isTxError,
  transactionsForConstructOnlySet,
} from "../../../domain";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSKWallet } from "../../../providers/sk-wallet";
import type { GetStakeSessionError, SendTransactionError } from "./errors";
import {
  SignError,
  SubmitError,
  SubmitHashError,
  TXCheckError,
  TransactionConstructError,
} from "./errors";

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

export const useStepsMachine = (session: ActionDto) => {
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

  const multiSend = useMemo(
    () => Maybe.fromNullable(connector).map(shouldMultiSend).orDefault(false),
    [connector]
  );

  const machineParams = useSavedRef({
    session,
    multiSend,
    isLedgerLive,
    trackEvent,
    signMultipleTransactions,
    signMessage,
    signTransaction,
    transactionSubmit,
    transactionGetTransactionStatusFromId,
    transactionGetTransaction,
    transactionSubmitHash,
    transactionGetGasForNetwork,
    transactionConstruct,
  });

  return useMachine(useState(() => getMachine(machineParams))[0]);
};

const getMachine = (
  ref: Readonly<
    MutableRefObject<{
      session: ActionDto;
      multiSend: boolean;
      isLedgerLive: boolean;
      trackEvent: ReturnType<typeof useTrackEvent>;
      signMultipleTransactions: ReturnType<
        typeof useSKWallet
      >["signMultipleTransactions"];
      signMessage: ReturnType<typeof useSKWallet>["signMessage"];
      signTransaction: ReturnType<typeof useSKWallet>["signTransaction"];
      transactionSubmit: ReturnType<typeof useTransactionSubmitHook>;
      transactionGetTransactionStatusFromId: ReturnType<
        typeof useTransactionGetTransactionStatusFromIdHook
      >;
      transactionGetTransaction: ReturnType<
        typeof useTransactionGetTransactionHook
      >;
      transactionSubmitHash: ReturnType<typeof useTransactionSubmitHashHook>;
      transactionGetGasForNetwork: ReturnType<
        typeof useTransactionGetGasForNetworkHook
      >;
      transactionConstruct: ReturnType<typeof useTransactionConstructHook>;
    }>
  >
) => {
  const txConstruct = (
    ...params: Parameters<(typeof ref)["current"]["transactionConstruct"]>
  ) =>
    withRequestErrorRetry({
      fn: () => ref.current.transactionConstruct(...params),
      shouldRetry: (e, retryCount) =>
        retryCount <= 3 && isAxiosError(e) && e.response?.status === 404,
    }).mapLeft(() => new Error("Transaction construct error"));

  const initContext = getInitContext(
    ref.current.session,
    ref.current.multiSend
  );

  return setup({
    types: {
      emitted: {} as { type: "signSuccess" },
      context: {} as {
        yieldId: Maybe<string>;
        txStates: TxState[];
        currentTxMeta: Maybe<{ idx: number; id: string }>;
        txCheckTimeoutId: Maybe<number>;
      },
      events: {} as
        | { type: "START" }
        | {
            type: "__SIGN_SUCCESS__";
            val: Extract<SignRes, { type: "regular" }>;
          }
        | { type: "__SIGN_ERROR__"; val: Error }
        | { type: "__BROADCAST_SUCCESS__" }
        | { type: "__BROADCAST_ERROR__"; val: Error | SubmitHashError }
        | { type: "__DONE__"; val: TxState[] }
        | { type: "__SIGN_RETRY__" }
        | { type: "__BROADCAST_RETRY__" }
        | {
            type: "__SIGN_NEXT_TX__";
            val: {
              newCurrentTxMeta: {
                idx: number;
                id: string;
              };
              newTxStates: TxState[];
            };
          }
        | {
            type: "__TX_CHECK_ERROR__";
            val: Error | SignError | TXCheckError;
          }
        | { type: "__TX_CHECK_RETRY__" }
        | { type: "__TX_CHECK_RETRY_TIMEOUT__"; val: number },
    },
  }).createMachine({
    context: {
      yieldId: Maybe.fromNullable(initContext?.yieldId),
      txStates: initContext?.txStates ?? [],
      currentTxMeta: Maybe.fromNullable(initContext?.currentTxMeta),
      txCheckTimeoutId: Maybe.empty(),
    },
    initial: initContext.enabled ? "idle" : "disabled",
    states: {
      idle: {
        on: { START: "signLoading" },
      },
      disabled: {},
      signLoading: {
        on: {
          __SIGN_SUCCESS__: {
            target: "broadcastLoading",
            actions: [
              assign({
                txStates: ({ context, event }) =>
                  context.currentTxMeta
                    .map((currentTxMeta) =>
                      context.txStates.map((val, i) =>
                        i === currentTxMeta.idx
                          ? {
                              ...val,
                              meta: {
                                ...val.meta,
                                txCheckError: null,
                                signError: null,
                                broadcasted: event.val.data.broadcasted,
                                signedTx: event.val.data.signedTx,
                              },
                            }
                          : val
                      )
                    )
                    .orDefault(context.txStates),
              }),
              emit({ type: "signSuccess" }),
            ],
          },
          __SIGN_ERROR__: {
            target: "signError",
            actions: assign({
              txStates: ({ context, event }) =>
                context.currentTxMeta
                  .map((currentTxMeta) =>
                    context.txStates.map((val, i) =>
                      i === currentTxMeta.idx
                        ? {
                            ...val,
                            meta: {
                              ...val.meta,
                              txCheckError: null,
                              signError: event.val,
                            },
                          }
                        : val
                    )
                  )
                  .orDefault(context.txStates),
            }),
          },
          __BROADCAST_SUCCESS__: "txCheckLoading",
        },
        entry: ({ context, self }) => {
          EitherAsync.liftEither(
            context.currentTxMeta
              .chainNullable((v) => context.txStates[v.idx].tx)
              .toEither(new Error("missing tx"))
          )
            .chain<Error, SignRes>((tx) => {
              const txs = ref.current.session.transactions;

              /**
               * Multi sign transactions
               */
              if (ref.current.multiSend) {
                return EitherAsync.liftEither(
                  Right(
                    txs.find((tx) =>
                      transactionsForConstructOnlySet.has(tx.type)
                    )
                  )
                )
                  .chain((constructOnlyTx) => {
                    if (!constructOnlyTx) {
                      return EitherAsync.liftEither(Right(null));
                    }

                    return getAverageGasMode({
                      network: constructOnlyTx.network,
                      transactionGetGasForNetwork:
                        ref.current.transactionGetGasForNetwork,
                    })
                      .chainLeft(async () => Right(null))
                      .chain((gas) =>
                        txConstruct(constructOnlyTx.id, {
                          gasArgs: gas?.gasArgs,
                          ledgerWalletAPICompatible: ref.current.isLedgerLive,
                        }).mapLeft(() => new TransactionConstructError())
                      )
                      .chain(() =>
                        withRequestErrorRetry({
                          fn: () =>
                            ref.current.transactionGetTransactionStatusFromId(
                              constructOnlyTx.id
                            ),
                          retryTimes: 10,
                          retryWaitForMs: () => 5000,
                        }).mapLeft(
                          () =>
                            new Error(
                              `failed to get ${constructOnlyTx.id} tx status`
                            )
                        )
                      );
                  })
                  .map(() => getTransactionsForMultiSign(txs))
                  .chain((txs) =>
                    getAverageGasMode({
                      network: tx.network,
                      transactionGetGasForNetwork:
                        ref.current.transactionGetGasForNetwork,
                    }).chain((gas) =>
                      EitherAsync.sequence(
                        txs.map((tx) =>
                          txConstruct(tx.id, {
                            gasArgs: gas?.gasArgs,
                            ledgerWalletAPICompatible: ref.current.isLedgerLive,
                          }).mapLeft(() => new TransactionConstructError())
                        )
                      )
                    )
                  )
                  .map((txs) =>
                    txs
                      .map((tx) => tx.unsignedTransaction)
                      .filter((tx) => tx !== null)
                  )
                  .chain((txs) => {
                    if (!txs.length) {
                      return EitherAsync.liftEither(
                        Left(new TransactionConstructError())
                      );
                    }

                    return ref.current.signMultipleTransactions({ txs });
                  })
                  .map((val) => ({ type: "regular", data: val }));
              }

              /**
               * Single sign transactions
               */
              return getAverageGasMode({
                network: tx.network,
                transactionGetGasForNetwork:
                  ref.current.transactionGetGasForNetwork,
              })
                .chainLeft(async () => Right(null))
                .chain((gas) =>
                  txConstruct(tx.id, {
                    gasArgs: gas?.gasArgs,
                    ledgerWalletAPICompatible: ref.current.isLedgerLive,
                  }).mapLeft(() => new TransactionConstructError())
                )
                .chain((constructedTx) => {
                  if (
                    constructedTx.status === "BROADCASTED" ||
                    constructedTx.status === "CONFIRMED"
                  ) {
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
                    return ref.current
                      .signMessage(constructedTx.unsignedTransaction)
                      .map((val) => ({
                        type: "regular",
                        data: { signedTx: val, broadcasted: false },
                      }));
                  }

                  return ref.current
                    .signTransaction({
                      tx: constructedTx.unsignedTransaction,
                      ledgerHwAppId: constructedTx.ledgerHwAppId,
                    })
                    .map((val) => ({
                      ...val,
                      network: constructedTx.network,
                      txId: constructedTx.id,
                    }))
                    .ifRight(() =>
                      ref.current.trackEvent("txSigned", {
                        txId: constructedTx.id,
                        network: constructedTx.network,
                        yieldId: context.yieldId,
                      })
                    )
                    .map((val) => ({ type: "regular", data: val }));
                });
            })
            .caseOf({
              Left: (l) => {
                console.log(l);
                self.send({ type: "__SIGN_ERROR__", val: l });
              },
              Right: (signRes) => {
                if (signRes.type === "broadcasted") {
                  return self.send({ type: "__BROADCAST_SUCCESS__" });
                }

                self.send({ type: "__SIGN_SUCCESS__", val: signRes });
              },
            });
        },
      },

      signError: {
        on: { __SIGN_RETRY__: "signLoading" },
      },

      broadcastLoading: {
        on: {
          __BROADCAST_SUCCESS__: {
            target: "txCheckLoading",
            actions: assign({
              txStates: ({ context }) =>
                context.currentTxMeta
                  .map((currentTxMeta) =>
                    context.txStates.map((val, i) =>
                      i === currentTxMeta.idx
                        ? {
                            ...val,
                            meta: {
                              ...val.meta,
                              txCheckError: null,
                              signError: null,
                            },
                          }
                        : val
                    )
                  )
                  .orDefault(context.txStates),
            }),
          },
          __BROADCAST_ERROR__: {
            target: "broadcastError",
            actions: assign({
              txStates: ({ context }) =>
                context.currentTxMeta
                  .map((currentTxMeta) =>
                    context.txStates.map((val, i) =>
                      i === currentTxMeta.idx
                        ? {
                            ...val,
                            meta: {
                              ...val.meta,
                              txCheckError: null,
                              signError: null,
                            },
                          }
                        : val
                    )
                  )
                  .orDefault(context.txStates),
            }),
          },
        },
        entry: ({ self, context }) => {
          EitherAsync.liftEither(
            context.currentTxMeta
              .chainNullable((v) => context.txStates[v.idx])
              .toEither(new Error("missing tx"))
          )
            .chain((currentTx) => {
              if (currentTx.meta.broadcasted) {
                return withRequestErrorRetry({
                  fn: () =>
                    ref.current.transactionSubmitHash(currentTx.tx.id, {
                      hash: currentTx.meta.signedTx!,
                    }),
                })
                  .mapLeft(() => new SubmitHashError())
                  .ifRight(() => {
                    ref.current.trackEvent("txSubmitted", {
                      txId: currentTx.tx.id,
                      network: currentTx.tx.network,
                      yieldId: context.yieldId,
                    });
                  });
              }

              return withRequestErrorRetry({
                fn: async () => {
                  await ref.current.transactionSubmit(currentTx.tx.id, {
                    signedTransaction: currentTx.meta.signedTx!,
                  });
                },
              })
                .mapLeft(() => new SubmitError())
                .ifRight(() => {
                  ref.current.trackEvent("txSubmitted", {
                    txId: currentTx.tx.id,
                    network: currentTx.tx.network,
                    yieldId: context.yieldId,
                  });
                });
            })
            .caseOf({
              Left: (l) => {
                console.log(l);
                self.send({ type: "__BROADCAST_ERROR__", val: l });
              },
              Right: () => self.send({ type: "__BROADCAST_SUCCESS__" }),
            });
        },
      },

      broadcastError: {
        on: { __BROADCAST_RETRY__: "broadcastLoading" },
      },

      txCheckLoading: {
        on: {
          __SIGN_NEXT_TX__: {
            target: "signLoading",
            actions: assign({
              currentTxMeta: ({ event }) =>
                Maybe.of(event.val.newCurrentTxMeta),
              txStates: ({ event }) => event.val.newTxStates,
            }),
          },
          __DONE__: {
            target: "done",
            actions: assign({ txStates: ({ event }) => event.val }),
          },
          __TX_CHECK_ERROR__: {
            target: "txCheckError",
            actions: assign({
              txStates: ({ context, event }) =>
                context.currentTxMeta
                  .map((currentTxMeta) =>
                    context.txStates.map((val, i) =>
                      i === currentTxMeta.idx
                        ? {
                            ...val,
                            meta: {
                              ...val.meta,
                              txCheckError: event.val,
                              signError: null,
                            },
                          }
                        : val
                    )
                  )
                  .orDefault(context.txStates),
            }),
          },
          __TX_CHECK_RETRY__: "txCheckRetry",
        },
        entry: ({ self, context }) => {
          EitherAsync.liftEither(
            context.currentTxMeta
              .chainNullable((v) => context.txStates[v.idx])
              .toEither(new Error("missing tx"))
          )
            .chain((currentTx) =>
              withRequestErrorRetry({
                fn: () =>
                  ref.current.transactionGetTransactionStatusFromId(
                    currentTx.tx.id
                  ),
                shouldRetry: (e, retryCount) =>
                  retryCount <= 3 &&
                  isAxiosError(e) &&
                  (e.response?.status === 404 || e.response?.status === 503),
              })
                .map((res) => ({ url: res.url, status: res.status }))
                .chainLeft(() =>
                  withRequestErrorRetry({
                    fn: () =>
                      ref.current.transactionGetTransaction(currentTx.tx.id),
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
                  ref.current.trackEvent("txNotConfirmed", {
                    txId: l.txId,
                    yieldId: context.yieldId,
                  });
                }

                self.send({ type: "__TX_CHECK_ERROR__", val: l });
              },
              Right: (v) => {
                if (v.isConfirmed) {
                  const newTxStates = context.currentTxMeta
                    .map((currentTxMeta) =>
                      context.txStates.map((val, i) =>
                        i === currentTxMeta.idx
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
                      )
                    )
                    .orDefault(context.txStates);

                  const newCurrentTxMeta = List.findIndex(
                    (val) => !val.meta.done,
                    newTxStates
                  )
                    .map((idx) => ({
                      idx,
                      id: newTxStates[idx].tx.id,
                    }))
                    .extractNullable();

                  if (!newCurrentTxMeta) {
                    return self.send({ type: "__DONE__", val: newTxStates });
                  }

                  self.send({
                    type: "__SIGN_NEXT_TX__",
                    val: { newTxStates, newCurrentTxMeta },
                  });
                } else {
                  self.send({ type: "__TX_CHECK_RETRY__" });
                }
              },
            });
        },
      },

      txCheckRetry: {
        on: {
          __TX_CHECK_RETRY__: "txCheckLoading",
          __TX_CHECK_RETRY_TIMEOUT__: {
            actions: assign({
              txCheckTimeoutId: ({ event }) => Maybe.of(event.val),
            }),
          },
        },
        entry: ({ self }) => {
          const timeoutHandler = setTimeout(() => {
            self.send({ type: "__TX_CHECK_RETRY__" });
          }, 4000);

          self.send({
            type: "__TX_CHECK_RETRY_TIMEOUT__",
            val: timeoutHandler as unknown as number,
          });
        },
      },

      txCheckError: {
        on: { __TX_CHECK_RETRY__: "txCheckLoading" },
      },

      done: {
        type: "final",
      },
    },
  });
};

const getInitContext = (session: ActionDto, shouldMultiSend: boolean) => {
  if (!session.transactions.length) {
    return {
      enabled: false,
      txStates: null,
      currentTxMeta: null,
      yieldId: null,
    };
  }

  const txStates = session.transactions.map<TxState>((dto) => ({
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
    id: session.transactions[currentTxIdx].id,
  };

  return {
    enabled: true,
    txStates: shouldMultiSend ? [txStates[currentTxIdx]] : txStates,
    currentTxMeta,
    yieldId: session.integrationId,
  };
};
