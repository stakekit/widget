import { useMutation, useQuery } from "@tanstack/react-query";
import { useSelector } from "@xstate/store/react";
import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { getTransactionGasEstimate } from "../../../domain/types/action";
import { getKycProviderName } from "../../../domain/types/kyc";
import { isBittensorStaking } from "../../../domain/types/yields";
import { useTokensPrices } from "../../../hooks/api/use-tokens-prices";
import { useYieldKycGate } from "../../../hooks/api/use-yield-kyc-gate";
import { usePositionDetailsStakeMatch } from "../../../hooks/navigation/use-position-details-stake-match";
import { useEstimatedRewards } from "../../../hooks/use-estimated-rewards";
import { useGasWarningCheck } from "../../../hooks/use-gas-warning-check";
import { useRewardTokenDetails } from "../../../hooks/use-reward-token-details";
import { useSavedRef } from "../../../hooks/use-saved-ref";
import { useYieldType } from "../../../hooks/use-yield-type";
import { useApiClient } from "../../../providers/api/api-client-provider";
import { useEnterStakeStore } from "../../../providers/enter-stake-store";
import { useSettings } from "../../../providers/settings";
import { defaultFormattedNumber } from "../../../utils";
import { getGasFeeInUSD } from "../../../utils/formatters";
import type { PageCta } from "../../components/page-cta";
import type { MetaInfoProps } from "../pages/common-page/common.page";
import { useFees } from "./use-fees";

export const useStakeReview = () => {
  const enterStore = useEnterStakeStore();

  const enterRequest = useSelector(
    enterStore,
    (state) => state.context.data
  ).unsafeCoerce();

  const apiClient = useApiClient();

  const stakeAmount = useMemo(
    () => new BigNumber(enterRequest.requestDto.arguments?.amount ?? 0),
    [enterRequest]
  );

  const selectedStake = useMemo(
    () => Maybe.of(enterRequest.selectedStake),
    [enterRequest.selectedStake]
  );
  const selectedToken = useMemo(
    () => Maybe.of(enterRequest.selectedToken),
    [enterRequest.selectedToken]
  );
  const yieldKycGate = useYieldKycGate({ yieldDto: selectedStake });
  const kycGateIsBlocking = yieldKycGate.isGateBlocking;

  const actionPreviewQuery = useQuery({
    enabled: !!enterRequest && !kycGateIsBlocking,
    queryKey: ["stake-review-action-preview", enterRequest.requestDto],
    retry: false,
    queryFn: () =>
      apiClient.yield.ActionsControllerEnterYield({
        payload: enterRequest.requestDto,
      }),
  });

  const stakeEnterTxGas = useMemo(
    () =>
      Maybe.fromNullable(actionPreviewQuery.data)
        .map((actionDto) =>
          actionDto.transactions.reduce((acc, transaction) => {
            const decoded = getTransactionGasEstimate(transaction);

            return acc.plus(decoded?.amount ?? 0);
          }, new BigNumber(0))
        )
        .map((value) => (value.isZero() ? null : value))
        .chainNullable((value) => value),
    [actionPreviewQuery.data]
  );

  const gasCheckWarning = useGasWarningCheck({
    gasAmount: stakeEnterTxGas,
    gasFeeToken: enterRequest.gasFeeToken,
    address: enterRequest.addresses.address,
    additionalAddresses: enterRequest.addresses.additionalAddresses,
    isStake: true,
    stakeAmount,
    stakeToken: enterRequest.selectedToken,
  });

  const selectedProviderYieldId = useMemo(
    () => Maybe.fromNullable(enterRequest.requestDto.arguments?.providerId),
    [enterRequest.requestDto.arguments?.providerId]
  );

  const rewardToken = useRewardTokenDetails(selectedStake);
  const estimatedRewards = useEstimatedRewards({
    selectedStake,
    stakeAmount,
    selectedValidators: enterRequest.selectedValidators,
    selectedProviderYieldId,
  });
  const yieldType = useYieldType(selectedStake).mapOrDefault(
    (y) => y.review,
    ""
  );

  const amount = useMemo(
    () => defaultFormattedNumber(stakeAmount),
    [stakeAmount]
  );
  const interestRate = useMemo(
    () => estimatedRewards.mapOrDefault((r) => r.percentage.toString(), ""),
    [estimatedRewards]
  );

  const symbol = selectedToken.mapOrDefault((val) => val.symbol, "");
  const rewardsTokenSymbol = useMemo(
    () =>
      selectedStake
        .filter((val) => isBittensorStaking(val.id))
        .chain(() => List.head([...enterRequest.selectedValidators.values()]))
        .map((validator) => validator.subnet?.tokenSymbol ?? "")
        .orDefault(symbol),
    [enterRequest.selectedValidators, selectedStake, symbol]
  );

  const estimatedRewardAmounts = useMemo(
    () =>
      estimatedRewards.map((rewards) => ({
        earnYearly: `${rewards.yearly} ${rewardsTokenSymbol}`,
        earnMonthly: `${rewards.monthly} ${rewardsTokenSymbol}`,
      })),
    [estimatedRewards, rewardsTokenSymbol]
  );

  const pricesState = useTokensPrices({
    token: selectedToken,
    yieldDto: selectedStake,
  });

  const fee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: stakeEnterTxGas,
        prices: Maybe.fromNullable(pricesState.data),
        yieldDto: selectedStake,
      }),
    [pricesState.data, selectedStake, stakeEnterTxGas]
  );

  const { depositFee, managementFee, performanceFee } = useFees({
    amount: stakeAmount,
    token: selectedToken,
    feeConfigDto: Maybe.empty(),
    yieldFee: useMemo(
      () =>
        (
          enterRequest.selectedStake as typeof enterRequest.selectedStake & {
            mechanics?: {
              fee?: {
                deposit?: string;
                management?: string;
                performance?: string;
              };
            };
          }
        ).mechanics?.fee ?? null,
      [enterRequest.selectedStake]
    ),
    prices: useMemo(
      () => Maybe.fromNullable(pricesState.data),
      [pricesState.data]
    ),
  });

  const metadata = selectedStake.map((yieldDto) => ({
    logoURI: yieldDto.metadata.logoURI,
    name: yieldDto.metadata.name,
    provider: yieldDto.provider,
  }));
  const kycProviderName = selectedStake
    .map(getKycProviderName)
    .extractNullable();
  const onKycStatusRefresh = () => yieldKycGate.refetch();

  const navigate = useNavigate();
  const positionDetailsStakeReviewMatch =
    usePositionDetailsStakeMatch("review");

  const enterMutation = useMutation({
    mutationFn: async () => {
      return (
        actionPreviewQuery.data ??
        (await actionPreviewQuery.refetch()).data ??
        Promise.reject(new Error("Stake enter error"))
      );
    },
    onSuccess: (data) => {
      enterStore.send({ type: "setActionDto", data });
      if (positionDetailsStakeReviewMatch) {
        navigate("../steps", { relative: "path" });

        return;
      }

      navigate("/steps");
    },
  });

  const onClick = () => {
    if (kycGateIsBlocking) return;

    enterMutation.mutate();
  };

  const onClickRef = useSavedRef(onClick);

  const { t } = useTranslation();

  const cta = useMemo<PageCta>(
    () => ({
      disabled: kycGateIsBlocking,
      isLoading: enterMutation.isPending || yieldKycGate.isLoading,
      label: t("shared.confirm"),
      onClick: () => onClickRef.current(),
    }),
    [
      enterMutation.isPending,
      kycGateIsBlocking,
      onClickRef,
      t,
      yieldKycGate.isLoading,
    ]
  );

  const { variant } = useSettings();

  const metaInfo = useMemo(
    () =>
      (variant === "zerion"
        ? {
            showMetaInfo: true,
            metaInfoProps: {
              selectedStake,
              selectedToken,
              selectedValidators: enterRequest.selectedValidators,
            },
          }
        : { showMetaInfo: false }) satisfies MetaInfoProps,
    [selectedStake, selectedToken, enterRequest.selectedValidators, variant]
  );

  return {
    token: selectedToken,
    amount,
    fee,
    interestRate,
    estimatedRewardAmounts,
    yieldType,
    rewardToken,
    metadata,
    metaInfo,
    isGasCheckWarning: !!gasCheckWarning.data,
    gasCheckLoading:
      actionPreviewQuery.isLoading ||
      actionPreviewQuery.isFetching ||
      gasCheckWarning.isLoading,
    depositFee,
    managementFee,
    performanceFee,
    feeConfigLoading: actionPreviewQuery.isLoading,
    commissionFee: Maybe.empty(),
    kycGate: yieldKycGate.gate,
    kycProviderName,
    kycStatusIsChecking:
      yieldKycGate.isLoading ||
      yieldKycGate.isFetching ||
      yieldKycGate.isRefetching,
    onKycStatusRefresh,
    cta,
  };
};
