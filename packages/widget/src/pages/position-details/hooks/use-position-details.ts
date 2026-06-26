import { useMutation } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { getKycProviderName } from "../../../domain/types/kyc";
import {
  getRewardRateBreakdown,
  type YieldRewardRateDto,
} from "../../../domain/types/reward-rate";
import { isForceMaxAmount } from "../../../domain/types/stake";
import type { TokenDto } from "../../../domain/types/tokens";
import {
  getYieldActionArg,
  isYieldValidatorSelectionRequired,
} from "../../../domain/types/yields";
import { useYieldKycGate } from "../../../hooks/api/use-yield-kyc-gate";
import { useYieldValidators } from "../../../hooks/api/use-yield-validators";
import {
  getPositionDetailsUnstakeReviewPath,
  useUnstakeOrPendingActionParams,
} from "../../../hooks/navigation/use-unstake-or-pending-action-params";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useSetExitStakeRequest } from "../../../providers/exit-stake-store";
import { defaultFormattedNumber } from "../../../utils";
import {
  useUnstakeOrPendingActionDispatch,
  useUnstakeOrPendingActionState,
} from "../state";
import { usePendingActions } from "./use-pending-actions";
import { useStakeExitRequestDto } from "./use-stake-exit-request-dto";

const hasCampaignRewardRate = (
  rewardRate: YieldRewardRateDto | null | undefined
) =>
  !!getRewardRateBreakdown(rewardRate).find((item) => item.key === "campaign");

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
  const { plain } = useUnstakeOrPendingActionParams();

  const stakeExitRequestDto = useStakeExitRequestDto();
  const setExitStakeRequest = useSetExitStakeRequest();
  const yieldKycGate = useYieldKycGate({ yieldDto: integrationData });
  const kycGateIsBlocking = yieldKycGate.isGateBlocking;
  const kycProviderName = integrationData
    .map(getKycProviderName)
    .extractNullable();
  const onKycStatusRefresh = () => {
    void yieldKycGate.refetch();
  };

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
      if (kycGateIsBlocking) return null;

      Maybe.fromRecord({
        stakeExitRequestDto,
        integrationData,
        unstakeToken,
      }).ifJust((val) => {
        setExitStakeRequest(
          Maybe.of({
            addresses: val.stakeExitRequestDto.addresses,
            actionDto: Maybe.empty(),
            gasFeeToken: val.stakeExitRequestDto.gasFeeToken,
            integrationData: val.integrationData,
            requestDto: val.stakeExitRequestDto.dto,
            unstakeAmount,
            unstakeToken: val.unstakeToken,
          })
        );
        navigate(
          getPositionDetailsUnstakeReviewPath(plain) ?? "unstake/review"
        );
      });

      return null;
    },
  });

  const onUnstakeClick = onClickHandler.mutate;

  const _unstakeAmountError = onClickHandler.isError || unstakeAmountError;

  const dispatch = useUnstakeOrPendingActionDispatch();

  const trackEvent = useTrackEvent();

  const baseToken = integrationData.map((val) => val.token);

  const shouldFetchValidators = integrationData
    .map(isYieldValidatorSelectionRequired)
    .orDefault(false);

  const yieldValidators = useYieldValidators({
    enabled: shouldFetchValidators,
    yieldId:
      integrationData.map((val) => val.id).extractNullable() ?? undefined,
    network:
      integrationData.map((val) => val.token.network).extractNullable() ??
      undefined,
  });

  const validatorsData = shouldFetchValidators
    ? yieldValidators.data
    : undefined;

  const providersDetails = useProvidersDetails({
    integrationData,
    validators: positionBalances.data.map((b) => {
      return b.type === "validators" ? b.validators : [];
    }),
    selectedProviderYieldId: Maybe.empty(),
  });

  const personalizedRewardRate = useMemo(
    () =>
      positionBalances.data
        .map((balanceData) => balanceData.rewardRate)
        .filter(hasCampaignRewardRate)
        .extractNullable(),
    [positionBalances.data]
  );

  const fallbackRewardRate = useMemo(
    () =>
      integrationData
        .map((yieldData) => yieldData.rewardRate)
        .filter(hasCampaignRewardRate)
        .extractNullable(),
    [integrationData]
  );

  const apyCompositionRewardRate = personalizedRewardRate ?? fallbackRewardRate;
  const apyCompositionShowsUpToCampaign =
    !personalizedRewardRate && !!fallbackRewardRate;

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

  const unstakeDisabled =
    yieldOpportunity.isLoading || !unstakeAvailable || kycGateIsBlocking;

  const isLoading =
    positionBalances.isLoading ||
    positionBalancePrices.isLoading ||
    yieldOpportunity.isLoading ||
    yieldValidators.isLoading;

  return {
    integrationData,
    validatorsData: validatorsData ?? [],
    hasMoreValidators: !!yieldValidators.hasNextPage,
    isLoadingMoreValidators: yieldValidators.isFetchingNextPage,
    onLoadMoreValidators: yieldValidators.fetchNextPage,
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
    kycGate: yieldKycGate.gate,
    kycGateIsChecking:
      yieldKycGate.isLoading ||
      yieldKycGate.isFetching ||
      yieldKycGate.isRefetching,
    kycProviderName,
    onKycStatusRefresh,
    isLoading,
    onPendingActionClick,
    providersDetails,
    personalizedRewardRate,
    apyCompositionRewardRate,
    apyCompositionShowsUpToCampaign,
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
