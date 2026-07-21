import BigNumber from "bignumber.js";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { AppToken } from "../../../../../domain/schema/legacy-models";
import { getKycProviderName } from "../../../../../domain/types/kyc";
import {
  getRewardRateBreakdown,
  type YieldRewardRateDto,
} from "../../../../../domain/types/reward-rate";
import { isForceMaxAmount } from "../../../../../domain/types/stake";

import {
  getYieldActionArg,
  isYieldValidatorSelectionRequired,
} from "../../../../../domain/types/yields";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import {
  getPositionDetailsUnstakeReviewPath,
  useUnstakeOrPendingActionParams,
} from "../../../../../shared/react/navigation/use-unstake-or-pending-action-params";
import { useStartClassicTransactionFlow } from "../../../../classic-transaction-flow/react/use-transaction-flow";
import { useProvidersDetails } from "../../../../earn/react/use-provider-details";
import { useYieldKycGate } from "../../../../earn/react/use-yield-kyc-gate";
import { useYieldValidators } from "../../../../earn/react/use-yield-validators";
import { useTrackEvent } from "../../../../tracking/react/use-track-event";
import { useUnstakeOrPendingAction } from "../state";
import { usePendingActions } from "./use-pending-actions";
import { useStakeExitRequestDto } from "./use-stake-exit-request-dto";

const hasCampaignRewardRate = (
  rewardRate: YieldRewardRateDto | null | undefined
) =>
  !!getRewardRateBreakdown(rewardRate).find((item) => item.key === "campaign");

export const usePositionDetails = () => {
  const { dispatch, state: positionWorkflow } = useUnstakeOrPendingAction();
  const {
    unstakeAmount,
    integrationData,
    yieldOpportunity,
    positionBalances,
    positionBalancesResult,
    reducedStakedOrLiquidBalance,
    positionBalancesByType,
    positionBalancePrices,
    unstakeAmountValid,
    unstakeToken,
    unstakeAmountError,
    canChangeUnstakeAmount,
    unstakeIsGreaterOrLessIntegrationLimitError,
    minUnstakeAmount,
    currentWalletScope,
  } = positionWorkflow;

  const navigate = useNavigate();
  const { plain } = useUnstakeOrPendingActionParams();

  const stakeExitRequestDto = useStakeExitRequestDto(positionWorkflow);
  const startClassicTransactionFlow = useStartClassicTransactionFlow();
  const yieldKycGate = useYieldKycGate({
    yieldDto: integrationData,
  });
  const kycGateIsBlocking = yieldKycGate.isGateBlocking;
  const kycProviderName = integrationData
    ? getKycProviderName(integrationData)
    : null;
  const onKycStatusRefresh = () => {
    void yieldKycGate.refetch();
  };

  const unstakeMaxAmount = useMemo(
    () =>
      (() => {
        const amount = integrationData
          ? getYieldActionArg(integrationData, "exit", "amount")
          : null;
        return amount && !isForceMaxAmount(amount)
          ? (amount.maximum ?? null)
          : null;
      })(),
    [integrationData]
  );

  const unstakeMinAmount = useMemo(
    () =>
      (() => {
        const amount = integrationData
          ? getYieldActionArg(integrationData, "exit", "amount")
          : null;
        const minimum = minUnstakeAmount.toNumber();
        return amount &&
          !isForceMaxAmount(amount) &&
          new BigNumber(minimum).isGreaterThan(0)
          ? minimum
          : null;
      })(),
    [integrationData, minUnstakeAmount]
  );

  const [unstakeSubmissionError, setUnstakeSubmissionError] = useState(false);
  const onUnstakeClick = () => {
    if (!unstakeAmountValid) {
      setUnstakeSubmissionError(true);
      return;
    }
    setUnstakeSubmissionError(false);
    if (kycGateIsBlocking) return;

    if (stakeExitRequestDto && integrationData && unstakeToken) {
      startClassicTransactionFlow({
        _tag: "Exit",
        gasFeeToken: stakeExitRequestDto.gasFeeToken,
        integration: integrationData,
        providersDetails: providersDetails ?? [],
        request: stakeExitRequestDto.dto,
        unstakeAmount,
        unstakeToken,
        walletScope: currentWalletScope,
      });
      navigate(getPositionDetailsUnstakeReviewPath(plain) ?? "unstake/review");
    }
  };

  const _unstakeAmountError = unstakeSubmissionError || unstakeAmountError;

  const trackEvent = useTrackEvent();

  const baseToken = integrationData?.token ?? null;

  const shouldFetchValidators = integrationData
    ? isYieldValidatorSelectionRequired(integrationData)
    : false;

  const yieldValidators = useYieldValidators({
    enabled: shouldFetchValidators,
    yieldId: integrationData?.id,
    network: integrationData?.token.network,
  });

  const validatorsData = shouldFetchValidators
    ? yieldValidators.data
    : undefined;

  const providersDetails = useProvidersDetails({
    integrationData,
    validators:
      positionBalances?.type === "validators"
        ? positionBalances.validators
        : null,
    selectedProviderYieldId: null,
  });

  const personalizedRewardRate = useMemo(
    () =>
      positionBalances && hasCampaignRewardRate(positionBalances.rewardRate)
        ? positionBalances.rewardRate
        : null,
    [positionBalances]
  );

  const fallbackRewardRate = useMemo(
    () =>
      integrationData && hasCampaignRewardRate(integrationData.rewardRate)
        ? integrationData.rewardRate
        : null,
    [integrationData]
  );

  const apyCompositionRewardRate = personalizedRewardRate ?? fallbackRewardRate;
  const apyCompositionShowsUpToCampaign =
    !personalizedRewardRate && !!fallbackRewardRate;

  const canUnstake = !!integrationData?.status.exit;

  const onUnstakeAmountChange = (value: BigNumber) =>
    dispatch({ type: "unstake/amount/change", data: value });

  const unstakeFormattedAmount = useMemo(
    () =>
      reducedStakedOrLiquidBalance
        ? `$${defaultFormattedNumber(reducedStakedOrLiquidBalance.amountUsd)}`
        : "",
    [reducedStakedOrLiquidBalance]
  );

  const onMaxClick = () => {
    if (!integrationData) return;
    trackEvent("positionDetailsPageMaxClicked", {
      yieldId: integrationData.id,
    });

    dispatch({ type: "unstake/amount/max" });
  };

  const unstakeAvailable = integrationData?.status.exit ?? false;

  const {
    onPendingActionAmountChange,
    pendingActions,
    onPendingActionClick,
    onValidatorsSubmit,
    validatorAddressesHandling,
  } = usePendingActions({
    dispatch,
    providersDetails: providersDetails ?? [],
    workflow: positionWorkflow,
  });

  const shareToAmountConversions = useMemo(
    () =>
      integrationData && positionBalancesByType && baseToken
        ? [...positionBalancesByType.values()].reduce((acc, curr) => {
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
          }, new Map<AppToken["symbol"], string>())
        : null,
    [integrationData, positionBalancesByType, baseToken]
  );

  const unstakeDisabled =
    AsyncResult.isInitial(yieldOpportunity) ||
    !unstakeAvailable ||
    kycGateIsBlocking;

  const isLoading =
    AsyncResult.isInitial(positionBalancesResult) ||
    AsyncResult.isInitial(positionBalancePrices) ||
    AsyncResult.isInitial(yieldOpportunity) ||
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
