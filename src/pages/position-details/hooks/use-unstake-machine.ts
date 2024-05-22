import useStateMachine, { t } from "@cassiozen/usestatemachine";
import type { $$t } from "@cassiozen/usestatemachine/dist/types";
import type { TransactionVerificationMessageDto } from "@stakekit/api-hooks";
import { useTransactionGetTransactionVerificationMessageForNetworkHook } from "@stakekit/api-hooks";
import merge from "lodash.merge";
import { EitherAsync, Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useUnstakeOrPendingActionState } from "../state";
import { useOnStakeExit } from "./use-on-stake-exit";
import { useStakeExitRequestDto } from "./use-stake-exit-request-dto";

const tt = t as <T>() => {
  [$$t]: T;
};

export const useUnstakeMachine = () => {
  const trackEvent = useTrackEvent();
  const stakeExitRequestDto = useStakeExitRequestDto();
  const onStakeExit = useOnStakeExit();

  const { network, address, additionalAddresses, signMessage } = useSKWallet();

  const transactionGetTransactionVerificationMessageForNetwork =
    useTransactionGetTransactionVerificationMessageForNetworkHook();

  const { unstakeAmount, integrationData, unstakeToken } =
    useUnstakeOrPendingActionState();

  const initValues = useMemo(
    () =>
      Maybe.fromRecord({
        integrationData,
        unstakeToken,
        network: Maybe.fromNullable(network),
        address: Maybe.fromNullable(address),
      }),
    [address, integrationData, network, unstakeToken]
  );

  return useStateMachine({
    schema: {
      context: tt<{
        error: Error | null;
        transactionVerificationMessageDto: TransactionVerificationMessageDto | null;
        signedMessage: string | null;
      }>(),
    },
    initial: "initial",
    context: {
      error: null,
      transactionVerificationMessageDto: null,
      signedMessage: null,
    },
    on: { UNSTAKE: "unstakeCheck" },
    states: {
      initial: {},
      unstakeCheck: {
        on: {
          __UNSTAKE_GET_VERIFICATION_MESSAGE__:
            "unstakeGetVerificationMessageLoading",
          __UNSTAKE__: "unstakeLoading",
        },
        effect: ({ send }) => {
          initValues.ifJust((val) => {
            trackEvent("unstakeClicked", {
              yieldId: val.integrationData.id,
              amount: unstakeAmount.toString(),
            });

            if (
              val.integrationData.args.exit?.args?.signatureVerification
                ?.required
            ) {
              send("__UNSTAKE_GET_VERIFICATION_MESSAGE__");
            } else {
              send("__UNSTAKE__");
            }
          });
        },
      },

      unstakeGetVerificationMessageLoading: {
        on: {
          __UNSTAKE_GET_VERIFICATION_MESSAGE_SUCCESS__: "unstakeShowPopup",
          __UNSTAKE_GET_VERIFICATION_MESSAGE_ERROR__:
            "unstakeGetVerificationMessageError",
        },
        effect: ({ send, setContext }) => {
          EitherAsync.liftEither(
            initValues.toEither(new Error("Missing init values"))
          )
            .chain((val) =>
              EitherAsync(() =>
                transactionGetTransactionVerificationMessageForNetwork(
                  val.network,
                  {
                    addresses: {
                      address: val.address,
                      additionalAddresses: additionalAddresses ?? undefined,
                    },
                  }
                )
              ).mapLeft(() => new Error("Failed to get verification message"))
            )
            .caseOf({
              Right(v) {
                setContext((ctx) => ({
                  ...ctx,
                  transactionVerificationMessageDto: v,
                }));
                send("__UNSTAKE_GET_VERIFICATION_MESSAGE_SUCCESS__");
              },
              Left(l) {
                setContext((ctx) => ({ ...ctx, error: l }));
                send("__UNSTAKE_GET_VERIFICATION_MESSAGE_ERROR__");
              },
            });
        },
      },
      unstakeGetVerificationMessageError: {},

      unstakeShowPopup: {
        on: {
          CONTINUE_MESSAGE_SIGN: "unstakeSignMessageLoading",
          CANCEL_MESSAGE_SIGN: "initial",
        },
      },

      unstakeSignMessageLoading: {
        on: {
          __UNSTAKE_SIGN_MESSAGE_SUCCESS__: "unstakeLoading",
          __UNSTAKE_SIGN_MESSAGE_ERROR__: "unstakeSignMessageError",
        },
        effect: ({ send, context, setContext }) => {
          EitherAsync.liftEither(
            Maybe.fromNullable(
              context.transactionVerificationMessageDto
            ).toEither(new Error("Missing transaction verification message"))
          )
            .chain((val) => signMessage(val.message))
            .caseOf({
              Right(v) {
                setContext((ctx) => ({ ...ctx, signedMessage: v }));

                send("__UNSTAKE_SIGN_MESSAGE_SUCCESS__");
              },
              Left(l) {
                setContext((ctx) => ({ ...ctx, error: l }));

                send("__UNSTAKE_SIGN_MESSAGE_ERROR__");
              },
            });
        },
      },
      unstakeSignMessageError: {},

      unstakeLoading: {
        on: {
          __UNSTAKE_ERROR__: "unstakeError",
          __UNSTAKE_DONE__: "unstakeDone",
        },
        effect: ({ context, setContext, send }) => {
          EitherAsync.liftEither(
            Maybe.fromRecord({ stakeExitRequestDto, initValues })
              .map((val) => {
                if (
                  context.transactionVerificationMessageDto &&
                  context.signedMessage
                ) {
                  return {
                    ...val,
                    stakeExitRequestDto: merge(val.stakeExitRequestDto, {
                      dto: {
                        args: {
                          signatureVerification: {
                            message:
                              context.transactionVerificationMessageDto.message,
                            signed: context.signedMessage,
                          },
                        },
                      },
                    } as Partial<typeof val>),
                  };
                }

                return val;
              })
              .toEither(new Error("Missing params"))
          )
            .chain((val) =>
              EitherAsync(() =>
                onStakeExit.mutateAsync({
                  stakeRequestDto: val.stakeExitRequestDto,
                  stakeExitData: {
                    integrationData: val.initValues.integrationData,
                    interactedToken: val.initValues.unstakeToken,
                  },
                })
              ).mapLeft((e) => {
                console.log(e);
                return new Error("Failed to unstake");
              })
            )
            .caseOf({
              Right() {
                send("__UNSTAKE_DONE__");
              },
              Left(error) {
                setContext((ctx) => ({ ...ctx, error }));
                send("__UNSTAKE_ERROR__");
              },
            });
        },
      },
      unstakeDone: {},
      unstakeError: {},
    },
  });
};
