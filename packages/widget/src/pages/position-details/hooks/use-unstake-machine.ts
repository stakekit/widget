import useStateMachine, { t } from "@cassiozen/usestatemachine";
import type { $$t } from "@cassiozen/usestatemachine/dist/types";
import { withRequestErrorRetry } from "@sk-widget/common/utils";
import { getValidStakeSessionTx } from "@sk-widget/domain";
import {
  useExitStakeState,
  useExitStakeStateDispatch,
} from "@sk-widget/providers/exit-stake-state";
import type { TransactionVerificationMessageDto } from "@stakekit/api-hooks";
import {
  useActionExitHook,
  useTransactionGetTransactionVerificationMessageForNetworkHook,
} from "@stakekit/api-hooks";
import merge from "lodash.merge";
import { EitherAsync, Just, Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSKWallet } from "../../../providers/sk-wallet";

const tt = t as <T>() => {
  [$$t]: T;
};

export const useUnstakeMachine = () => {
  const trackEvent = useTrackEvent();
  const actionExit = useActionExitHook();

  const exitRequest = useExitStakeState().unsafeCoerce();
  const setExitDispatch = useExitStakeStateDispatch();

  const { network, address, additionalAddresses, signMessage } = useSKWallet();

  const transactionGetTransactionVerificationMessageForNetwork =
    useTransactionGetTransactionVerificationMessageForNetworkHook();

  const initValues = useMemo(
    () =>
      Maybe.fromRecord({
        network: Maybe.fromNullable(network),
        address: Maybe.fromNullable(address),
      }),
    [address, network]
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
          trackEvent("unstakeClicked", {
            yieldId: exitRequest.integrationData.id,
            amount: exitRequest.requestDto.args.amount,
          });

          if (
            exitRequest.integrationData.args.exit?.args?.signatureVerification
              ?.required
          ) {
            send("__UNSTAKE_GET_VERIFICATION_MESSAGE__");
          } else {
            send("__UNSTAKE__");
          }
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
            Just(exitRequest.requestDto)
              .map((val) => {
                if (
                  context.transactionVerificationMessageDto &&
                  context.signedMessage
                ) {
                  return merge(val, {
                    dto: {
                      args: {
                        signatureVerification: {
                          message:
                            context.transactionVerificationMessageDto.message,
                          signed: context.signedMessage,
                        },
                      },
                    },
                  } as Partial<typeof val>);
                }

                return val;
              })
              .toEither(new Error("Missing params"))
          )
            .chain((val) =>
              withRequestErrorRetry({ fn: () => actionExit(val) })
                .mapLeft(() => new Error("Stake exit error"))
                .chain((actionDto) =>
                  EitherAsync.liftEither(getValidStakeSessionTx(actionDto))
                )
                .ifRight((val) =>
                  setExitDispatch((prev) =>
                    prev.map((v) => ({ ...v, actionDto: Just(val) }))
                  )
                )
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
