import { useMutation } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { getRewardRateBreakdown } from "../../../domain/types/reward-rate";
import { isForceMaxAmount } from "../../../domain/types/stake";
import type { TokenDto } from "../../../domain/types/tokens";
import { getYieldActionArg } from "../../../domain/types/yields";
import { useYieldValidators } from "../../../hooks/api/use-yield-validators";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useExitStakeStore } from "../../../providers/exit-stake-store";
import { defaultFormattedNumber } from "../../../utils";
import {
  useUnstakeOrPendingActionDispatch,
  useUnstakeOrPendingActionState,
} from "../state";
import { usePendingActions } from "./use-pending-actions";
import { useStakeExitRequestDto } from "./use-stake-exit-request-dto";

export const usePositionDetails = () => {
  const {
    unstakeAmount,
    integrationData,
    yieldOpportunity,
    positionBalances,
    reducedStakedOrLiquidBalance,
    positionBalancesByType,
    positionBalancePrices,
    unstakeAmountValid,
    unstakeToken,
    unstakeAmountError,
    canChangeUnstakeAmount,
    unstakeIsGreaterOrLessIntegrationLimitError,
    minUnstakeAmount,
  } = useUnstakeOrPendingActionState();

  const navigate = useNavigate();

  const stakeExitRequestDto = useStakeExitRequestDto();
  const exitStore = useExitStakeStore();

  const unstakeMaxAmount = useMemo(
    () =>
      integrationData
        .chainNullable((val) => getYieldActionArg(val, "exit", "amount"))
        .filter((val) => !isForceMaxAmount(val))
        .chainNullable((val) => val.maximum),
    [integrationData]
  );

  const unstakeMinAmount = useMemo(
    () =>
      integrationData
        .chainNullable((val) => getYieldActionArg(val, "exit", "amount"))
        .filter((val) => !isForceMaxAmount(val))
        .map(() => minUnstakeAmount.toNumber())
        .filter((val) => new BigNumber(val).isGreaterThan(0)),
    [integrationData, minUnstakeAmount]
  );

  const onClickHandler = useMutation({
    mutationKey: [unstakeAmount.toString()],
    mutationFn: async () => {
      if (!unstakeAmountValid) throw new Error("Invalid amount");

      Maybe.fromRecord({
        stakeExitRequestDto,
        integrationData,
        unstakeToken,
      }).ifJust((val) => {
        exitStore.send({
          type: "initFlow",
          data: {
            addresses: val.stakeExitRequestDto.addresses,
            gasFeeToken: val.stakeExitRequestDto.gasFeeToken,
            integrationData: val.integrationData,
            requestDto: val.stakeExitRequestDto.dto,
            unstakeAmount,
            unstakeToken: val.unstakeToken,
          },
        });
        navigate("unstake/review");
      });

      return null;
    },
  });

  const onUnstakeClick = onClickHandler.mutate;

  const _unstakeAmountError = onClickHandler.isError || unstakeAmountError;

  const dispatch = useUnstakeOrPendingActionDispatch();

  const trackEvent = useTrackEvent();

  const baseToken = integrationData.map((val) => val.token);

  const yieldValidators = useYieldValidators({
    enabled: integrationData.isJust(),
    yieldId:
      integrationData.map((val) => val.id).extractNullable() ?? undefined,
    network:
      integrationData.map((val) => val.token.network).extractNullable() ??
      undefined,
  });

  const providersDetails = useProvidersDetails({
    integrationData,
    validatorsAddresses: positionBalances.data.map((b) => {
      return b.type === "validators" ? b.validatorsAddresses : [];
    }),
    selectedProviderYieldId: Maybe.empty(),
    validatorsData: Maybe.fromNullable(yieldValidators.data),
  });

  const personalizedRewardRate = useMemo(
    () =>
      positionBalances.data
        .map((balanceData) => balanceData.rewardRate)
        .filter(
          (rewardRate) =>
            !!getRewardRateBreakdown(rewardRate).find(
              (item) => item.key === "campaign"
            )
        )
        .extractNullable(),
    [positionBalances.data]
  );

  const canUnstake = integrationData.filter((d) => !!d.status.exit).isJust();

  const onUnstakeAmountChange = (value: BigNumber) =>
    dispatch({ type: "unstake/amount/change", data: value });

  const unstakeFormattedAmount = useMemo(
    () =>
      reducedStakedOrLiquidBalance
        .map((val) => val.amountUsd)
        .mapOrDefault((v) => `$${defaultFormattedNumber(v)}`, ""),
    [reducedStakedOrLiquidBalance]
  );

  const onMaxClick = () => {
    trackEvent("positionDetailsPageMaxClicked", {
      yieldId: integrationData.map((v) => v.id).extract(),
    });

    dispatch({ type: "unstake/amount/max" });
  };

  const unstakeAvailable = integrationData.mapOrDefault(
    (d) => d.status.exit,
    false
  );

  const {
    onPendingActionAmountChange,
    pendingActions,
    onPendingActionClick,
    onValidatorsSubmit,
    validatorAddressesHandling,
  } = usePendingActions();

  const shareToAmountConversions = useMemo(
    () =>
      Maybe.fromRecord({
        integrationData,
        positionBalancesByType,
        baseToken,
      }).map((v) =>
        [...v.positionBalancesByType.values()].reduce((acc, curr) => {
          curr
            .filter((yb) => yb.shareAmount && yb.amount && !yb.token.isPoints)
            .forEach((yb) => {
              acc.set(
                yb.token.symbol,
                `1 ${yb.token.symbol} = ${defaultFormattedNumber(
                  new BigNumber(yb.shareAmount ?? 0).dividedBy(
                    new BigNumber(yb.amount ?? 0)
                  )
                )} ${yb.shareToken?.symbol}`
              );
            });

          return acc;
        }, new Map<TokenDto["symbol"], string>())
      ),
    [integrationData, positionBalancesByType, baseToken]
  );

  const unstakeDisabled = yieldOpportunity.isLoading || !unstakeAvailable;

  const isLoading =
    positionBalances.isLoading ||
    positionBalancePrices.isLoading ||
    yieldOpportunity.isLoading ||
    yieldValidators.isLoading;

  return {
    integrationData,
    validatorsData: yieldValidators.data ?? [],
    reducedStakedOrLiquidBalance,
    positionBalancesByType,
    canUnstake,
    unstakeAmount,
    onUnstakeAmountChange,
    unstakeFormattedAmount,
    onMaxClick,
    canChangeUnstakeAmount,
    onUnstakeClick,
    unstakeDisabled,
    isLoading,
    onPendingActionClick,
    providersDetails,
    personalizedRewardRate,
    pendingActions,
    shareToAmountConversions,
    validatorAddressesHandling,
    onValidatorsSubmit,
    onPendingActionAmountChange,
    unstakeToken,
    unstakeAmountError: _unstakeAmountError,
    unstakeMaxAmount,
    unstakeMinAmount,
    unstakeIsGreaterOrLessIntegrationLimitError,
  };
};
