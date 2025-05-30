import type { ActionMeta } from "@sk-widget/domain/types/wallets/generic-wallet";
import { useSavedRef } from "@sk-widget/hooks";
import { useSettings } from "@sk-widget/providers/settings";
import type {
  SendTransactionError,
  TransactionDecodeError,
} from "@sk-widget/providers/sk-wallet/errors";
import type {
  ActionDto,
  TransactionDto,
  TransactionFormat,
} from "@stakekit/api-hooks";
import {
  transactionConstruct,
  transactionGetTransaction,
  transactionGetTransactionStatusFromId,
  transactionSubmit,
  transactionSubmitHash,
} from "@stakekit/api-hooks";
import { useMachine } from "@xstate/react";
import { isAxiosError } from "axios";
import { EitherAsync, Left, List, Maybe, Right } from "purify-ts";
import { type RefObject, useMemo, useState } from "react";
import { assign, emit, setup } from "xstate";
import { getAverageGasMode } from "../../../common/get-gas-mode-value";
import { withRequestErrorRetry } from "../../../common/utils";
import { isTxError } from "../../../domain";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSKWallet } from "../../../providers/sk-wallet";
import type { GetStakeSessionError } from "./errors";
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
    | SendTransactionError
    | TransactionDecodeError
    | TransactionConstructError
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

export const useStepsMachine = ({
  transactions,
  integrationId,
  actionMeta,
}: {
  transactions: ActionDto["transactions"];
  integrationId: ActionDto["integrationId"];
  actionMeta: ActionMeta;
}) => {
  const { signTransaction, signMessage, isLedgerLive } = useSKWallet();
  const { preferredTransactionFormat } = useSettings();
  const trackEvent = useTrackEvent();

  const sortedTransactions = useMemo(
    () => transactions.sort((a, b) => a.stepIndex - b.stepIndex),
    [transactions]
  );

  const machineParams = useSavedRef({
    transactions: sortedTransactions,
    integrationId,
    isLedgerLive,
    trackEvent,
    signMessage,
    signTransaction,
    actionMeta,
    preferredTransactionFormat,
  });

  return useMachine(useState(() => getMachine(machineParams))[0]);
};

const getMachine = (
  ref: Readonly<
    RefObject<{
      transactions: ActionDto["transactions"];
      integrationId: ActionDto["integrationId"];
      isLedgerLive: boolean;
      trackEvent: ReturnType<typeof useTrackEvent>;
      signMessage: ReturnType<typeof useSKWallet>["signMessage"];
      signTransaction: ReturnType<typeof useSKWallet>["signTransaction"];
      actionMeta: ActionMeta;
      preferredTransactionFormat?: TransactionFormat;
    }>
  >
) => {
  const txConstruct = (...params: Parameters<typeof transactionConstruct>) =>
    withRequestErrorRetry({
      fn: () => transactionConstruct(...params),
      shouldRetry: (e, retryCount) =>
        retryCount <= 3 && isAxiosError(e) && e.response?.status === 404,
    }).mapLeft(() => new Error("Transaction construct error"));

  const initContext = getInitContext(
    ref.current.transactions,
    ref.current.integrationId
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
            val:
              | SendTransactionError
              | TransactionDecodeError
              | TransactionConstructError
              | SignError;
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
              .toEither(new TransactionConstructError("missing tx"))
          )
            .chain<
              | TransactionConstructError
              | SendTransactionError
              | TransactionDecodeError
              | SignError,
              SignRes
            >((tx) =>
              getAverageGasMode({ network: tx.network })
                .chainLeft(async () => Right(null))
                .chain((gas) =>
                  txConstruct(tx.id, {
                    gasArgs: gas?.gasArgs,
                    ledgerWalletAPICompatible: ref.current.isLedgerLive,
                    ...(!!ref.current.preferredTransactionFormat && {
                      transactionFormat: ref.current.preferredTransactionFormat,
                    }),
                  }).mapLeft(() => new TransactionConstructError())
                )
                .chain<
                  | TransactionConstructError
                  | SendTransactionError
                  | TransactionDecodeError
                  | SignError,
                  SignRes
                >((constructedTx) => {
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
                        type: "regular" as const,
                        data: { signedTx: val, broadcasted: false },
                      }))
                      .mapLeft(
                        () =>
                          new SignError({
                            network: constructedTx.network,
                            txId: constructedTx.id,
                          })
                      );
                  }

                  return ref.current
                    .signTransaction({
                      tx: constructedTx.unsignedTransaction,
                      ledgerHwAppId: constructedTx.ledgerHwAppId,
                      txMeta: {
                        ...ref.current.actionMeta,
                        txId: constructedTx.id,
                        txType: constructedTx.type,
                        annotatedTransaction:
                          constructedTx.annotatedTransaction,
                        structuredTransaction:
                          constructedTx.structuredTransaction,
                      },
                      network: constructedTx.network,
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
                })
            )
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
                return EitherAsync(() =>
                  transactionSubmitHash(currentTx.tx.id, {
                    hash: currentTx.meta.signedTx!,
                  })
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
                transactionSubmit(currentTx.tx.id, {
                  signedTransaction: currentTx.meta.signedTx!,
                })
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
                  transactionGetTransactionStatusFromId(currentTx.tx.id),
                shouldRetry: (e, retryCount) =>
                  retryCount <= 3 &&
                  isAxiosError(e) &&
                  e.response?.status === 404,
              })
                .map((res) => ({ url: res.url, status: res.status }))
                .chainLeft(() =>
                  EitherAsync(() =>
                    transactionGetTransaction(currentTx.tx.id)
                  ).map((res) => ({
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

const getInitContext = (
  transactions: ActionDto["transactions"],
  integrationId: ActionDto["integrationId"]
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
    id: transactions[currentTxIdx].id,
  };

  return {
    enabled: true,
    txStates,
    currentTxMeta,
    yieldId: integrationId,
  };
};
