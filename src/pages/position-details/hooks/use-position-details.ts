import { useMemo } from "react";
import { Maybe } from "purify-ts";
import { TokenDto } from "@stakekit/api-hooks";
import { getTokenPriceInUSD } from "../../../domain";
import BigNumber from "bignumber.js";
import { formatNumber } from "../../../utils";
import { useMaxMinYieldAmount } from "../../../hooks/use-max-min-yield-amount";
import {
  useUnstakeOrPendingActionDispatch,
  useUnstakeOrPendingActionState,
} from "../../../state/unstake-or-pending-action";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useForceMaxAmount } from "../../../hooks/use-force-max-amount";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { usePendingActions } from "./use-pending-actions";
import { useUnstakeMachine } from "./use-unstake-machine";

export const usePositionDetails = () => {
  const {
    unstakeAmount,
    integrationData,
    yieldOpportunity,
    positionBalances,
    reducedStakedOrLiquidBalance,
    positionBalancesByType,
    positionBalancePrices,
  } = useUnstakeOrPendingActionState();

  const dispatch = useUnstakeOrPendingActionDispatch();

  const trackEvent = useTrackEvent();

  const providersDetails = useProvidersDetails({
    integrationData,
    validatorsAddresses: positionBalances.data.map((b) =>
      b.type === "validators" ? b.validatorsAddresses : []
    ),
  });

  const forceMax = useForceMaxAmount({
    type: "exit",
    integration: integrationData,
  });

  const canUnstake = integrationData.map((d) => !!d.args.exit);
  const canChangeAmount = integrationData.map(
    (d) => !!(!forceMax && d.args.exit?.args?.amount?.required)
  );

  const { maxEnterOrExitAmount, minEnterOrExitAmount } = useMaxMinYieldAmount({
    yieldOpportunity: integrationData,
    type: "exit",
    positionBalancesByType,
  });

  const onUnstakeAmountChange = (value: BigNumber) =>
    dispatch({ type: "unstake/amount/change", data: value });

  const unstakeFormattedAmount = useMemo(
    () =>
      Maybe.fromRecord({
        prices: Maybe.fromNullable(positionBalancePrices.data),
        reducedStakedOrLiquidBalance,
      })
        .map((val) =>
          getTokenPriceInUSD({
            amount: unstakeAmount,
            token: val.reducedStakedOrLiquidBalance.token,
            prices: val.prices,
            pricePerShare: val.reducedStakedOrLiquidBalance.pricePerShare,
          })
        )
        .mapOrDefault((v) => `$${formatNumber(v, 2)}`, ""),
    [positionBalancePrices.data, reducedStakedOrLiquidBalance, unstakeAmount]
  );

  const onMaxClick = () => {
    trackEvent("positionDetailsPageMaxClicked", {
      yieldId: integrationData.map((v) => v.id).extract(),
    });

    dispatch({ type: "unstake/amount/max" });
  };

  const unstakeAmountValid = useMemo(
    () =>
      unstakeAmount.isGreaterThanOrEqualTo(minEnterOrExitAmount) &&
      unstakeAmount.isLessThanOrEqualTo(maxEnterOrExitAmount) &&
      !unstakeAmount.isZero(),
    [maxEnterOrExitAmount, minEnterOrExitAmount, unstakeAmount]
  );

  const unstakeAvailable = integrationData.mapOrDefault(
    (d) => d.status.exit,
    false
  );

  const {
    onPendingActionAmountChange,
    pendingActions,
    onPendingAction,
    onPendingActionClick,
    onValidatorsSubmit,
    validatorAddressesHandling,
  } = usePendingActions();

  const [machine, send] = useUnstakeMachine();

  const unstakeIsLoading =
    machine.value === "unstakeCheck" ||
    machine.value === "unstakeGetVerificationMessageLoading" ||
    machine.value === "unstakeSignMessageLoading" ||
    machine.value === "unstakeLoading";

  const onUnstakeClick = () => {
    if (unstakeIsLoading) return;

    send("UNSTAKE");
  };

  const onContinueUnstakeSignMessage = () => send("CONTINUE_MESSAGE_SIGN");
  const onCloseUnstakeSignMessage = () => send("CANCEL_MESSAGE_SIGN");

  const showUnstakeSignMessagePopup = machine.value === "unstakeShowPopup";

  const liquidTokensToNativeConversion = useMemo(
    () =>
      Maybe.fromRecord({ integrationData, positionBalancesByType })
        .chain((val) =>
          Maybe.fromPredicate(
            () => val.integrationData.metadata.type === "liquid-staking",
            val
          )
        )
        .map((v) =>
          [...v.positionBalancesByType.values()].reduce((acc, curr) => {
            curr.forEach((yb) =>
              acc.set(
                yb.token.symbol,
                `1 ${yb.token.symbol} = ${formatNumber(
                  new BigNumber(yb.pricePerShare)
                )} ${v.integrationData.metadata.token.symbol}`
              )
            );

            return acc;
          }, new Map<TokenDto["symbol"], string>())
        ),
    [integrationData, positionBalancesByType]
  );

  const unstakeDisabled =
    !unstakeAmountValid ||
    unstakeIsLoading ||
    onPendingAction.isPending ||
    yieldOpportunity.isLoading ||
    !unstakeAvailable;

  const isLoading =
    positionBalances.isLoading ||
    positionBalancePrices.isLoading ||
    yieldOpportunity.isLoading;

  return {
    integrationData,
    reducedStakedOrLiquidBalance,
    positionBalancesByType,
    canUnstake,
    unstakeAmount,
    onUnstakeAmountChange,
    unstakeFormattedAmount,
    onMaxClick,
    canChangeAmount,
    onUnstakeClick,
    onContinueUnstakeSignMessage,
    onCloseUnstakeSignMessage,
    showUnstakeSignMessagePopup,
    unstakeDisabled,
    isLoading,
    unstakeIsLoading,
    onPendingActionClick,
    providersDetails,
    pendingActions,
    liquidTokensToNativeConversion,
    validatorAddressesHandling,
    onValidatorsSubmit,
    onPendingActionAmountChange,
  };
};
