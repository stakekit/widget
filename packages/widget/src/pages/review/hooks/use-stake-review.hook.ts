import { useMutation, useQuery } from "@tanstack/react-query";
import { useSelector } from "@xstate/store/react";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useTokensPrices } from "../../../hooks/api/use-tokens-prices";
import { useEstimatedRewards } from "../../../hooks/use-estimated-rewards";
import { useGasWarningCheck } from "../../../hooks/use-gas-warning-check";
import { useRewardTokenDetails } from "../../../hooks/use-reward-token-details";
import { useSavedRef } from "../../../hooks/use-saved-ref";
import { useYieldType } from "../../../hooks/use-yield-type";
import { useEnterStakeStore } from "../../../providers/enter-stake-store";
import { useSettings } from "../../../providers/settings";
import { useYieldApiFetchClient } from "../../../providers/yield-api-client-provider";
import { createEnterAction } from "../../../providers/yield-api-client-provider/actions";
import { APToPercentage, formatNumber } from "../../../utils";
import { getGasFeeInUSD } from "../../../utils/formatters";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";
import type { MetaInfoProps } from "../pages/common-page/common.page";
import { useFees } from "./use-fees";

export const useStakeReview = () => {
  const enterStore = useEnterStakeStore();

  const enterRequest = useSelector(
    enterStore,
    (state) => state.context.data
  ).unsafeCoerce();

  const yieldApiFetchClient = useYieldApiFetchClient();

  const stakeAmount = useMemo(
    () => new BigNumber(enterRequest.requestDto.arguments?.amount ?? 0),
    [enterRequest]
  );

  const actionPreviewQuery = useQuery({
    enabled: !!enterRequest,
    queryKey: ["stake-review-action-preview", enterRequest.requestDto],
    retry: false,
    queryFn: () =>
      createEnterAction({
        addresses: enterRequest.addresses,
        fetchClient: yieldApiFetchClient,
        inputToken: enterRequest.selectedToken,
        requestDto: enterRequest.requestDto,
        yieldDto: enterRequest.selectedStake,
      }),
  });

  const stakeEnterTxGas = useMemo(
    () =>
      Maybe.fromNullable(actionPreviewQuery.data)
        .map((actionDto) =>
          actionDto.transactions.reduce(
            (acc, transaction) =>
              acc.plus(transaction.gasEstimate?.amount ?? 0),
            new BigNumber(0)
          )
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

  const selectedStake = useMemo(
    () => Maybe.of(enterRequest.selectedStake),
    [enterRequest.selectedStake]
  );
  const selectedToken = useMemo(
    () => Maybe.of(enterRequest.selectedToken),
    [enterRequest.selectedToken]
  );

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

  const amount = useMemo(() => formatNumber(stakeAmount), [stakeAmount]);
  const interestRate = useMemo(
    () => estimatedRewards.mapOrDefault((r) => r.percentage.toString(), ""),
    [estimatedRewards]
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

  const metadata = selectedStake.map((y) => y.metadata);

  const navigate = useNavigate();

  const enterMutation = useMutation({
    mutationFn: async () =>
      actionPreviewQuery.data ??
      (await actionPreviewQuery.refetch()).data ??
      Promise.reject(new Error("Stake enter error")),
    onSuccess: (data) => {
      enterStore.send({ type: "setActionDto", data });
      navigate("/steps");
    },
  });

  const onClick = () => enterMutation.mutate();

  const onClickRef = useSavedRef(onClick);

  const { t } = useTranslation();

  useRegisterFooterButton(
    useMemo(
      () => ({
        disabled: false,
        isLoading: enterMutation.isPending,
        label: t("shared.confirm"),
        onClick: () => onClickRef.current(),
      }),
      [onClickRef, t, enterMutation.isPending]
    )
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

  const commissionFee = useMemo(
    () =>
      selectedStake
        .chainNullable((y) => y.metadata.commission)
        .map((commission) =>
          commission.reduce((acc, curr) => acc + curr.value, 0)
        )
        .map((val) => `${APToPercentage(val)}%`),
    [selectedStake]
  );

  return {
    token: selectedToken,
    amount,
    fee,
    interestRate,
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
    commissionFee,
  };
};
