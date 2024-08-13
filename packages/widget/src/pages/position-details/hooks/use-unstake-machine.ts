import { withRequestErrorRetry } from "@sk-widget/common/utils";
import { getValidStakeSessionTx } from "@sk-widget/domain";
import type { SKWallet } from "@sk-widget/domain/types";
import { useSavedRef } from "@sk-widget/hooks";
import { useTrackEvent } from "@sk-widget/hooks/tracking/use-track-event";
import {
  useExitStakeState,
  useExitStakeStateDispatch,
} from "@sk-widget/providers/exit-stake-state";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import type { GetMaybeJust } from "@sk-widget/types";
import type { TransactionVerificationMessageDto } from "@stakekit/api-hooks";
import {
  useActionExitHook,
  useTransactionGetTransactionVerificationMessageForNetworkHook,
} from "@stakekit/api-hooks";
import { useMachine } from "@xstate/react";
import { EitherAsync, Just, Maybe } from "purify-ts";
import { type MutableRefObject, useState } from "react";
import { assign, setup } from "xstate";

export const useUnstakeMachine = () => {
  const trackEvent = useTrackEvent();
  const actionExit = useActionExitHook();

  const exitRequest = useExitStakeState().unsafeCoerce();
  const setExitDispatch = useExitStakeStateDispatch();

  const { network, address, additionalAddresses, signMessage } = useSKWallet();

  const transactionGetTransactionVerificationMessageForNetwork =
    useTransactionGetTransactionVerificationMessageForNetworkHook();

  const machineParams = useSavedRef({
    trackEvent,
    setExitDispatch,
    actionExit,
    signMessage,
    transactionGetTransactionVerificationMessageForNetwork,
    getData: () =>
      Maybe.fromRecord({
        network: Maybe.fromNullable(network),
        address: Maybe.fromNullable(address),
      }).map((val) => ({ ...val, ...exitRequest, additionalAddresses })),
  });

  return useMachine(useState(() => getMachine(machineParams))[0]);
};

const getMachine = (
  ref: Readonly<
    MutableRefObject<{
      transactionGetTransactionVerificationMessageForNetwork: ReturnType<
        typeof useTransactionGetTransactionVerificationMessageForNetworkHook
      >;
      setExitDispatch: ReturnType<typeof useExitStakeStateDispatch>;
      actionExit: ReturnType<typeof useActionExitHook>;
      signMessage: ReturnType<typeof useSKWallet>["signMessage"];
      trackEvent: ReturnType<typeof useTrackEvent>;
      getData: () => Maybe<
        GetMaybeJust<ReturnType<typeof useExitStakeState>> & {
          network: NonNullable<SKWallet["network"]>;
          address: NonNullable<SKWallet["address"]>;
          additionalAddresses: SKWallet["additionalAddresses"];
        }
      >;
    }>
  >
) =>
  setup({
    types: {
      context: {} as {
        error: Maybe<Error>;
        transactionVerificationMessageDto: Maybe<TransactionVerificationMessageDto>;
        signedMessage: Maybe<string>;
        data: ReturnType<(typeof ref)["current"]["getData"]>;
      },
      events: {} as
        | { type: "UNSTAKE" }
        | {
            type: "__GET_VERIFICATION_MESSAGE__";
            val: GetMaybeJust<ReturnType<(typeof ref)["current"]["getData"]>>;
          }
        | {
            type: "__SUBMIT__";
            val: GetMaybeJust<ReturnType<(typeof ref)["current"]["getData"]>>;
          }
        | { type: "__RESET__" }
        | {
            type: "__GET_VERIFICATION_MESSAGE_SUCCESS__";
            val: TransactionVerificationMessageDto;
          }
        | { type: "__GET_VERIFICATION_MESSAGE_ERROR__"; val: Error }
        | { type: "CONTINUE_MESSAGE_SIGN" }
        | { type: "CANCEL_MESSAGE_SIGN" }
        | { type: "__SIGN_MESSAGE_SUCCESS__"; val: string }
        | { type: "__SIGN_MESSAGE_ERROR__"; val: Error }
        | { type: "__SUBMIT_SUCCESS__" }
        | { type: "__SUBMIT_ERROR__" },
    },
  }).createMachine({
    context: {
      error: Maybe.empty(),
      transactionVerificationMessageDto: Maybe.empty(),
      signedMessage: Maybe.empty(),
      data: Maybe.empty(),
    },
    on: { UNSTAKE: { target: ".check", reenter: true } },
    initial: "initial",
    states: {
      initial: {},

      check: {
        on: {
          __GET_VERIFICATION_MESSAGE__: {
            target: "getVerificationMessage",
            actions: assign({ data: ({ event }) => Maybe.of(event.val) }),
          },
          __SUBMIT__: {
            target: "submit",
            actions: assign({ data: ({ event }) => Maybe.of(event.val) }),
          },
          __RESET__: "initial",
        },
        entry: ({ self }) =>
          ref.current.getData().caseOf({
            Just: (val) => {
              ref.current.trackEvent("unstakeClicked", {
                yieldId: val.integrationData.id,
                amount: val.requestDto.args.amount,
              });

              if (
                val.integrationData.args.exit?.args?.signatureVerification
                  ?.required
              ) {
                self.send({ type: "__GET_VERIFICATION_MESSAGE__", val });
              } else {
                self.send({ type: "__SUBMIT__", val });
              }
            },
            Nothing: () => self.send({ type: "__RESET__" }),
          }),
      },

      getVerificationMessage: {
        on: {
          __GET_VERIFICATION_MESSAGE_SUCCESS__: {
            target: "showPopup",
            actions: assign(({ context, event }) => ({
              ...context,
              transactionVerificationMessageDto: Maybe.of(event.val),
            })),
          },
          __GET_VERIFICATION_MESSAGE_ERROR__: {
            target: ".error",
            actions: assign(({ context, event }) => ({
              ...context,
              error: Maybe.of(event.val),
            })),
          },
        },
        initial: "loading",
        states: {
          loading: {
            entry: ({ self, context }) =>
              EitherAsync.liftEither(
                context.data.toEither(new Error("Missing init values"))
              )
                .chain((val) =>
                  withRequestErrorRetry({
                    fn: () =>
                      ref.current.transactionGetTransactionVerificationMessageForNetwork(
                        val.network,
                        {
                          addresses: {
                            address: val.address,
                            additionalAddresses:
                              val.additionalAddresses ?? undefined,
                          },
                        }
                      ),
                  }).mapLeft(
                    () => new Error("Failed to get verification message")
                  )
                )
                .caseOf({
                  Right(v) {
                    self.send({
                      type: "__GET_VERIFICATION_MESSAGE_SUCCESS__",
                      val: v,
                    });
                  },
                  Left(e) {
                    self.send({
                      type: "__GET_VERIFICATION_MESSAGE_ERROR__",
                      val: e,
                    });
                  },
                }),
          },

          error: {},
        },
      },

      showPopup: {
        on: {
          CONTINUE_MESSAGE_SIGN: "signMessage",
          CANCEL_MESSAGE_SIGN: "initial",
        },
      },

      signMessage: {
        on: {
          __SIGN_MESSAGE_SUCCESS__: {
            target: "submit",
            actions: assign(({ context, event }) => ({
              ...context,
              signedMessage: Maybe.of(event.val),
            })),
          },
          __SIGN_MESSAGE_ERROR__: {
            target: ".error",
            actions: assign(({ context, event }) => ({
              ...context,
              error: Maybe.of(event.val),
            })),
          },
        },
        initial: "loading",
        states: {
          loading: {
            entry: ({ self, context }) =>
              EitherAsync.liftEither(
                context.transactionVerificationMessageDto.toEither(
                  new Error("Missing transaction verification message")
                )
              )
                .chain((val) => ref.current.signMessage(val.message))
                .caseOf({
                  Right(v) {
                    self.send({
                      type: "__SIGN_MESSAGE_SUCCESS__",
                      val: v,
                    });
                  },
                  Left(l) {
                    self.send({ type: "__SIGN_MESSAGE_ERROR__", val: l });
                  },
                }),
          },
          error: {},
        },
      },

      submit: {
        on: {
          __SUBMIT_SUCCESS__: "done",
          __SUBMIT_ERROR__: ".error",
        },
        initial: "loading",
        states: {
          loading: {
            entry: ({
              self,
              context: {
                data,
                signedMessage,
                transactionVerificationMessageDto,
              },
            }) =>
              EitherAsync.liftEither(
                data
                  .map((val) => val.requestDto)
                  .map((requestDto) =>
                    Maybe.fromRecord({
                      transactionVerificationMessageDto,
                      signedMessage,
                    })
                      .map<typeof requestDto>(
                        (val) =>
                          ({
                            ...requestDto,
                            args: {
                              ...requestDto.args,
                              signatureVerification: {
                                message:
                                  val.transactionVerificationMessageDto.message,
                                signed: val.signedMessage,
                              },
                            },
                          }) satisfies typeof requestDto
                      )
                      .orDefault(requestDto)
                  )
                  .toEither(new Error("Missing params"))
              )
                .chain((val) =>
                  withRequestErrorRetry({
                    fn: () => ref.current.actionExit(val),
                  })
                    .mapLeft(() => new Error("Stake exit error"))
                    .chain((actionDto) =>
                      EitherAsync.liftEither(getValidStakeSessionTx(actionDto))
                    )
                    .ifRight((val) =>
                      ref.current.setExitDispatch((prev) =>
                        prev.map((v) => ({ ...v, actionDto: Just(val) }))
                      )
                    )
                )
                .caseOf({
                  Right() {
                    self.send({ type: "__SUBMIT_SUCCESS__" });
                  },
                  Left(error) {
                    assign(({ context }) => ({ ...context, error }));
                    self.send({ type: "__SUBMIT_ERROR__" });
                  },
                }),
          },
          error: {},
        },
      },

      done: {
        type: "final",
      },
    },
  });
