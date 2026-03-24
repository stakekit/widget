import { useMachine } from "@xstate/react";
import { EitherAsync, Left, List, Maybe, Right } from "purify-ts";
import { type RefObject, useMemo, useState } from "react";
import { assign, emit, setup } from "xstate";
import { isTxError } from "../../../domain";
import type { ActionDto, TransactionDto } from "../../../domain/types/action";
import type { ActionMeta } from "../../../domain/types/wallets/generic-wallet";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSavedRef } from "../../../hooks/use-saved-ref";
import { useSKWallet } from "../../../providers/sk-wallet";
import type {
  SendTransactionError,
  TransactionDecodeError,
} from "../../../providers/sk-wallet/errors";
import { useYieldApiFetchClient } from "../../../providers/yield-api-client-provider";
import {
  getTransaction,
  submitTransaction,
  submitTransactionHash,
} from "../../../providers/yield-api-client-provider/actions";
import type { GetStakeSessionError } from "./errors";
import {
  SignError,
  SubmitError,
  SubmitHashError,
  TXCheckError,
} from "./errors";

type TxMeta = {
  url: string | null;
  signedTx: string | null;
  broadcasted: boolean | null;
  signError: SendTransactionError | TransactionDecodeError | null;
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

export const useStepsMachine = ({
  transactions,
  yieldId,
  actionMeta,
}: {
  transactions: ActionDto["transactions"];
  yieldId: ActionDto["yieldId"];
  actionMeta: ActionMeta;
}) => {
  const { signTransaction, signMessage } = useSKWallet();
  const yieldApiFetchClient = useYieldApiFetchClient();
  const trackEvent = useTrackEvent();

  const sortedTransactions = useMemo(
    () =>
      [...transactions].sort((a, b) => (a.stepIndex ?? 0) - (b.stepIndex ?? 0)),
    [transactions],
  );

  const machineParams = useSavedRef({
    transactions: sortedTransactions,
    yieldId,
    trackEvent,
    signMessage,
    signTransaction,
    actionMeta,
    yieldApiFetchClient,
  });

  return useMachine(useState(() => getMachine(machineParams))[0]);
};

const getMachine = (
  ref: Readonly<
    RefObject<{
      transactions: ActionDto["transactions"];
      yieldId: ActionDto["yieldId"];
      trackEvent: ReturnType<typeof useTrackEvent>;
      signMessage: ReturnType<typeof useSKWallet>["signMessage"];
      signTransaction: ReturnType<typeof useSKWallet>["signTransaction"];
      actionMeta: ActionMeta;
      yieldApiFetchClient: ReturnType<typeof useYieldApiFetchClient>;
    }>
  >,
) => {
  const initContext = getInitContext(
    ref.current.transactions,
    ref.current.yieldId,
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
        | {
            type: "__SIGN_ERROR__";
            val: SendTransactionError | TransactionDecodeError | SignError;
          }
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
                          : val,
                      ),
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
                        : val,
                    ),
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
              .toEither(new SignError({ network: "unknown", txId: "unknown" })),
          )
            .chain<
              SendTransactionError | TransactionDecodeError | SignError,
              SignRes
            >((tx) => {
              if (tx.status === "BROADCASTED" || tx.status === "CONFIRMED") {
                return EitherAsync.liftEither(Right({ type: "broadcasted" }));
              }

              if (!tx.unsignedTransaction) {
                return EitherAsync.liftEither(
                  Left(
                    new SignError({
                      network: tx.network,
                      txId: tx.id,
                    }),
                  ),
                );
              }

              if (tx.isMessage) {
                const unsignedMessage =
                  typeof tx.unsignedTransaction === "string"
                    ? tx.unsignedTransaction
                    : JSON.stringify(tx.unsignedTransaction);

                return ref.current
                  .signMessage(unsignedMessage)
                  .map((val) => ({
                    type: "regular" as const,
                    data: { signedTx: val, broadcasted: false },
                  }))
                  .mapLeft(
                    () =>
                      new SignError({
                        network: tx.network,
                        txId: tx.id,
                      }),
                  );
              }

              const unsignedTransaction =
                typeof tx.unsignedTransaction === "string"
                  ? tx.unsignedTransaction
                  : JSON.stringify(tx.unsignedTransaction);

              return ref.current
                .signTransaction({
                  tx: unsignedTransaction,
                  ledgerHwAppId: null,
                  txMeta: {
                    ...ref.current.actionMeta,
                    txId: tx.id,
                    txType: tx.type,
                    annotatedTransaction: tx.annotatedTransaction,
                    structuredTransaction: tx.structuredTransaction,
                  },
                  network: tx.network as Parameters<
                    typeof ref.current.signTransaction
                  >[0]["network"],
                })
                .map((val) => ({
                  ...val,
                  network: tx.network,
                  txId: tx.id,
                }))
                .ifRight(() =>
                  ref.current.trackEvent("txSigned", {
                    txId: tx.id,
                    network: tx.network,
                    yieldId: context.yieldId,
                  }),
                )
                .map((val) => ({ type: "regular", data: val }));
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
                        : val,
                    ),
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
                        : val,
                    ),
                  )
                  .orDefault(context.txStates),
            }),
          },
        },
        entry: ({ self, context }) => {
          EitherAsync.liftEither(
            context.currentTxMeta
              .chainNullable((v) => context.txStates[v.idx])
              .toEither(new Error("missing tx")),
          )
            .chain((currentTx) => {
              if (currentTx.meta.broadcasted) {
                return EitherAsync(() =>
                  submitTransactionHash({
                    fetchClient: ref.current.yieldApiFetchClient,
                    hash: currentTx.meta.signedTx!,
                    transactionId: currentTx.tx.id,
                  }),
                )
                  .mapLeft(() => new SubmitHashError())
                  .ifRight(() => {
                    ref.current.trackEvent("txSubmitted", {
                      txId: currentTx.tx.id,
                      network: currentTx.tx.network,
                      yieldId: context.yieldId,
                    });
                  })
                  .void();
              }

              return EitherAsync(() =>
                submitTransaction({
                  fetchClient: ref.current.yieldApiFetchClient,
                  signedTransaction: currentTx.meta.signedTx!,
                  transactionId: currentTx.tx.id,
                }),
              )
                .mapLeft(() => new SubmitError())
                .ifRight(() => {
                  ref.current.trackEvent("txSubmitted", {
                    txId: currentTx.tx.id,
                    network: currentTx.tx.network,
                    yieldId: context.yieldId,
                  });
                })
                .void();
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
                        : val,
                    ),
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
              .toEither(new Error("missing tx")),
          )
            .chain((currentTx) =>
              EitherAsync(() =>
                getTransaction({
                  fetchClient: ref.current.yieldApiFetchClient,
                  transactionId: currentTx.tx.id,
                }),
              )
                .map((res) => ({
                  url: res.explorerUrl,
                  status: res.status,
                }))
                .mapLeft(() => new TXCheckError())
                .chain((val) =>
                  EitherAsync.liftEither(
                    isTxError(val.status)
                      ? Left(
                          new SignError({
                            txId: currentTx.tx.id,
                            network: currentTx.tx.network,
                          }),
                        )
                      : Right({
                          url: val.url,
                          isConfirmed: val.status === "CONFIRMED",
                        }),
                  ),
                ),
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
                                url: v.url ?? null,
                                done: true,
                              },
                            }
                          : val,
                      ),
                    )
                    .orDefault(context.txStates);

                  const newCurrentTxMeta = List.findIndex(
                    (val) => !val.meta.done,
                    newTxStates,
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

const getInitContext = (
  transactions: ActionDto["transactions"],
  yieldId: ActionDto["yieldId"],
) => {
  if (!transactions.length) {
    return {
      enabled: false,
      txStates: null,
      currentTxMeta: null,
      yieldId: null,
    };
  }

  const txStates = transactions.map<TxState>((dto) => ({
    tx: dto,
    meta: {
      broadcasted:
        dto.status === "BROADCASTED" || dto.status === "CONFIRMED"
          ? true
          : null,
      signedTx: null,
      url: dto.explorerUrl ?? null,
      signError: null,
      txCheckError: null,
      done: dto.status === "CONFIRMED" || dto.status === "SKIPPED",
    },
  }));

  const currentTxIdx = txStates.findIndex((txState) => !txState.meta.done);

  if (currentTxIdx === -1) {
    return {
      enabled: false,
      txStates,
      currentTxMeta: null,
      yieldId,
    };
  }

  const currentTxMeta = {
    idx: currentTxIdx,
    id: transactions[currentTxIdx].id,
  };

  return {
    enabled: true,
    txStates,
    currentTxMeta,
    yieldId,
  };
};
