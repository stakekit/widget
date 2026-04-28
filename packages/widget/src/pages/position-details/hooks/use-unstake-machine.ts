import { useMachine } from "@xstate/react";
import type { SnapshotFromStore } from "@xstate/store";
import { useSelector } from "@xstate/store/react";
import { EitherAsync, Maybe } from "purify-ts";
import { type RefObject, useState } from "react";
import { assign, setup } from "xstate";
import { transactionGetTransactionVerificationMessageForNetwork } from "../../../common/private-api";
import { getValidStakeSessionTx } from "../../../domain";
import type { TransactionVerificationMessageDto } from "../../../domain/types/transaction";
import type { SKWallet } from "../../../domain/types/wallet";
import { hasYieldExitSignatureVerification } from "../../../domain/types/yields";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSavedRef } from "../../../hooks/use-saved-ref";
import { useExitStakeStore } from "../../../providers/exit-stake-store";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useYieldApiFetchClient } from "../../../providers/yield-api-client-provider";
import { createExitAction } from "../../../providers/yield-api-client-provider/actions";
import type { GetMaybeJust } from "../../../types/utils";

export const useUnstakeMachine = ({ onDone }: { onDone: () => void }) => {
  const trackEvent = useTrackEvent();

  const exitStore = useExitStakeStore();
  const exitRequest = useSelector(
    useExitStakeStore(),
    (state) => state.context.data
  ).unsafeCoerce();

  const yieldApiFetchClient = useYieldApiFetchClient();
  const { network, address, additionalAddresses, signMessage } = useSKWallet();

  const machineParams = useSavedRef({
    onDone,
    trackEvent,
    exitStore,
    yieldApiFetchClient,
    signMessage,
    getData: () =>
      Maybe.fromRecord({
        network: Maybe.fromNullable(network),
        address: Maybe.fromNullable(address),
      }).map((val) => ({
        ...val,
        ...exitRequest,
        addresses: {
          ...exitRequest.addresses,
          additionalAddresses:
            exitRequest.addresses.additionalAddresses ??
            additionalAddresses ??
            undefined,
        },
      })),
  });

  return useMachine(useState(() => getMachine(machineParams))[0]);
};

const getMachine = (
  ref: Readonly<
    RefObject<{
      onDone: () => void;
      exitStore: ReturnType<typeof useExitStakeStore>;
      signMessage: ReturnType<typeof useSKWallet>["signMessage"];
      trackEvent: ReturnType<typeof useTrackEvent>;
      yieldApiFetchClient: ReturnType<typeof useYieldApiFetchClient>;
      getData: () => Maybe<
        GetMaybeJust<
          SnapshotFromStore<
            ReturnType<typeof useExitStakeStore>
          >["context"]["data"]
        > & {
          network: NonNullable<SKWallet["network"]>;
          address: NonNullable<SKWallet["address"]>;
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
                amount: val.requestDto.arguments?.amount,
              });

              if (hasYieldExitSignatureVerification(val.integrationData)) {
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
                  EitherAsync(() =>
                    transactionGetTransactionVerificationMessageForNetwork(
                      val.network,
                      {
                        addresses: {
                          address: val.addresses.address,
                          additionalAddresses:
                            val.addresses.additionalAddresses ?? undefined,
                        },
                      }
                    )
                  ).mapLeft(
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
                  .map((val) =>
                    Maybe.fromRecord({
                      data: Maybe.of(val),
                      requestDto: Maybe.of(val.requestDto),
                      transactionVerificationMessageDto,
                      signedMessage,
                    })
                      .map(
                        (val) =>
                          ({
                            ...val.data,
                            requestDto: {
                              ...val.requestDto,
                              address: val.data.addresses.address,
                              arguments: {
                                ...(val.requestDto.arguments ?? {}),
                                // The backend still accepts this legacy verification bag
                                // even though the checked-in schema does not expose it yet.
                                signatureVerification: {
                                  message:
                                    val.transactionVerificationMessageDto
                                      .message,
                                  signed: val.signedMessage,
                                },
                              } as typeof val.requestDto.arguments,
                            },
                          }) as typeof val.data
                      )
                      .orDefault(val)
                  )
                  .toEither(new Error("Missing params"))
              )
                .chain((val) =>
                  EitherAsync(() =>
                    createExitAction({
                      fetchClient: ref.current.yieldApiFetchClient,
                      requestDto: val.requestDto,
                    })
                  )
                    .mapLeft(() => new Error("Stake exit error"))
                    .chain((actionDto) =>
                      EitherAsync.liftEither(getValidStakeSessionTx(actionDto))
                    )
                    .ifRight((result) =>
                      ref.current.exitStore.send({
                        type: "setActionDto",
                        data: result,
                      })
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
        entry: ref.current.onDone,
      },
    },
  });
