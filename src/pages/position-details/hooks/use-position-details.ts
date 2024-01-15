import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { Maybe } from "purify-ts";
import { TokenDto } from "@stakekit/api-hooks";
import { getTokenPriceInUSD } from "../../../domain";
import BigNumber from "bignumber.js";
import { formatNumber } from "../../../utils";
import { useMaxMinYieldAmount } from "../../../hooks/use-max-min-yield-amount";
import { useOnStakeExit } from "./use-on-stake-exit";
import {
  useUnstakeOrPendingActionDispatch,
  useUnstakeOrPendingActionState,
} from "../../../state/unstake-or-pending-action";
import { useStakeExitRequestDto } from "./use-stake-exit-request-dto";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useForceMaxAmount } from "../../../hooks/use-force-max-amount";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { usePendingActions } from "./use-pending-actions";

export const usePositionDetails = () => {
  const {
    unstakeAmount,
    integrationData,
    integrationId,
    balanceId,
    yieldOpportunity,
    positionBalances,
    reducedStakedOrLiquidBalance,
    stakedOrLiquidBalances,
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

  const navigate = useNavigate();

  const onStakeExit = useOnStakeExit();

  const stakeExitRequestDto = useStakeExitRequestDto({
    balance: stakedOrLiquidBalances,
  });

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

  const onUnstakeClick = () => {
    trackEvent("unstakeClicked", {
      yieldId: integrationData.map((v) => v.id).extract(),
      amount: unstakeAmount.toString(),
    });

    onStakeExit.mutate(
      { stakeRequestDto: stakeExitRequestDto },
      {
        onSuccess: () =>
          Maybe.fromRecord({ integrationId, balanceId }).ifJust((val) =>
            navigate(
              `../../../unstake/${val.integrationId}/${val.balanceId}/review`,
              { relative: "path" }
            )
          ),
      }
    );
  };

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
    onStakeExit.isPending ||
    onPendingAction.isPending ||
    yieldOpportunity.isLoading ||
    !unstakeAvailable;

  const isLoading =
    positionBalances.isLoading ||
    positionBalancePrices.isLoading ||
    yieldOpportunity.isLoading;

  const error = onStakeExit.isError || onPendingAction.isError;

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
    error,
    unstakeDisabled,
    isLoading,
    onStakeExitIsLoading: onStakeExit.isPending,
    onPendingActionClick,
    providersDetails,
    pendingActions,
    liquidTokensToNativeConversion,
    validatorAddressesHandling,
    onValidatorsSubmit,
    onPendingActionAmountChange,
  };
};
