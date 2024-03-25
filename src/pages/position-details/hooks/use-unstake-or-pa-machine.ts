import useStateMachine from "@cassiozen/usestatemachine";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useUnstakeOrPendingActionState } from "../../../state/unstake-or-pending-action";
import { useTransactionGetTransactionVerificationMessageForNetworkHook } from "@stakekit/api-hooks";

export const useUnstakeOrPaMachine = () => {
  const trackEvent = useTrackEvent();

  const transactionGetTransactionVerificationMessageForNetwork =
    useTransactionGetTransactionVerificationMessageForNetworkHook();

  const { unstakeAmount, integrationData } = useUnstakeOrPendingActionState();

  return useStateMachine({
    initial: "initial",
    states: {
      initial: {
        on: {
          UNSTAKE: "unstake",
          __UNSTAKE_SIGN_MESSAGE__: "unstakeSignMessage",
        },
      },
      unstake: {
        effect: () => {
          trackEvent("unstakeClicked", {
            yieldId: integrationData.map((v) => v.id).extract(),
            amount: unstakeAmount.toString(),
          });
        },
      },
      unstakeSignMessage: {},
    },
  });
};
