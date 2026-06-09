import { useMachine } from "@xstate/react";
import type { SnapshotFromStore } from "@xstate/store";
import { useSelector } from "@xstate/store/react";
import { EitherAsync, Maybe } from "purify-ts";
import { type RefObject, useState } from "react";
import { assign, setup } from "xstate";
import { getValidStakeSessionTx } from "../../../domain";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSavedRef } from "../../../hooks/use-saved-ref";
import { useApiClient } from "../../../providers/api/api-client-provider";
import { useExitStakeStore } from "../../../providers/exit-stake-store";
import { useSKWallet } from "../../../providers/sk-wallet";
import type { GetMaybeJust } from "../../../types/utils";

export const useUnstakeMachine = ({ onDone }: { onDone: () => void }) => {
  const trackEvent = useTrackEvent();

  const exitStore = useExitStakeStore();
  const exitRequest = useSelector(
    useExitStakeStore(),
    (state) => state.context.data
  ).unsafeCoerce();

  const apiClient = useApiClient();
  const { address, additionalAddresses } = useSKWallet();

  const machineParams = useSavedRef({
    onDone,
    trackEvent,
    exitStore,
    apiClient,
    getData: () =>
      Maybe.fromRecord({
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
      trackEvent: ReturnType<typeof useTrackEvent>;
      apiClient: ReturnType<typeof useApiClient>;
      getData: () => Maybe<
        GetMaybeJust<
          SnapshotFromStore<
            ReturnType<typeof useExitStakeStore>
          >["context"]["data"]
        > & {
          address: string;
        }
      >;
    }>
  >
) =>
  setup({
    types: {
      context: {} as {
        error: Maybe<unknown>;
        data: ReturnType<(typeof ref)["current"]["getData"]>;
      },
      events: {} as
        | { type: "UNSTAKE" }
        | {
            type: "__SUBMIT__";
            val: GetMaybeJust<ReturnType<(typeof ref)["current"]["getData"]>>;
          }
        | { type: "__RESET__" }
        | { type: "__SUBMIT_SUCCESS__" }
        | { type: "__SUBMIT_ERROR__"; val: unknown },
    },
  }).createMachine({
    context: {
      error: Maybe.empty(),
      data: Maybe.empty(),
    },
    on: { UNSTAKE: { target: ".check", reenter: true } },
    initial: "initial",
    states: {
      initial: {},

      check: {
        on: {
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

              self.send({ type: "__SUBMIT__", val });
            },
            Nothing: () => self.send({ type: "__RESET__" }),
          }),
      },

      submit: {
        on: {
          __SUBMIT_SUCCESS__: "done",
          __SUBMIT_ERROR__: {
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
            entry: ({ self, context: { data } }) =>
              EitherAsync.liftEither(data.toEither(new Error("Missing params")))
                .chain((val) =>
                  EitherAsync(() =>
                    ref.current.apiClient.yield.ActionsControllerExitYield({
                      payload: val.requestDto,
                    })
                  )
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
                    self.send({ type: "__SUBMIT_ERROR__", val: error });
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
