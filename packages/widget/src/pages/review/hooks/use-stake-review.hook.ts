import { getValidStakeSessionTx } from "@sk-widget/domain";
import { useTokensPrices } from "@sk-widget/hooks/api/use-tokens-prices";
import { useEstimatedRewards } from "@sk-widget/hooks/use-estimated-rewards";
import { useGasWarningCheck } from "@sk-widget/hooks/use-gas-warning-check";
import { useRewardTokenDetails } from "@sk-widget/hooks/use-reward-token-details";
import { useSavedRef } from "@sk-widget/hooks/use-saved-ref";
import { useYieldType } from "@sk-widget/hooks/use-yield-type";
import { useRegisterFooterButton } from "@sk-widget/pages/components/footer-outlet/context";
import { useFees } from "@sk-widget/pages/review/hooks/use-fees";
import type { MetaInfoProps } from "@sk-widget/pages/review/pages/common-page/common.page";
import { useEnterStakeStore } from "@sk-widget/providers/enter-stake-store";
import { useSettings } from "@sk-widget/providers/settings";
import { formatNumber } from "@sk-widget/utils";
import { getGasFeeInUSD } from "@sk-widget/utils/formatters";
import {
  actionEnter,
  useActionEnterGasEstimation,
  useYieldGetFeeConfiguration,
} from "@stakekit/api-hooks";
import { useMutation } from "@tanstack/react-query";
import { useSelector } from "@xstate/store/react";
import { isAxiosError } from "axios";
import BigNumber from "bignumber.js";
import { EitherAsync, Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

export const useStakeReview = () => {
  const enterStore = useEnterStakeStore();

  const enterRequest = useSelector(
    enterStore,
    (state) => state.context.data
  ).unsafeCoerce();

  const integrationId = enterRequest.requestDto.integrationId;
  const feeConfigDto = useYieldGetFeeConfiguration(integrationId);

  const stakeAmount = useMemo(
    () => new BigNumber(enterRequest.requestDto.args.amount),
    [enterRequest]
  );

  const actionEnterGasEstimation = useActionEnterGasEstimation(
    enterRequest.requestDto,
    { query: { staleTime: 0, gcTime: 0 } }
  );

  const stakeEnterTxGas = useMemo(
    () =>
      Maybe.fromNullable(actionEnterGasEstimation.data?.amount).map(BigNumber),
    [actionEnterGasEstimation.data]
  );

  const gasCheckWarning = useGasWarningCheck({
    gasAmount: stakeEnterTxGas,
    gasFeeToken: enterRequest.gasFeeToken,
    address: enterRequest.requestDto.addresses.address,
    additionalAddresses: enterRequest.requestDto.addresses.additionalAddresses,
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

  const rewardToken = useRewardTokenDetails(selectedStake);
  const estimatedRewards = useEstimatedRewards({
    selectedStake,
    stakeAmount,
    selectedValidators: enterRequest.selectedValidators,
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
    feeConfigDto: useMemo(
      () => Maybe.fromNullable(feeConfigDto.data),
      [feeConfigDto.data]
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
      (
        await EitherAsync(() => actionEnter(enterRequest.requestDto))
          .mapLeft<StakingNotAllowedError | Error>((e) => {
            if (
              isAxiosError(e) &&
              StakingNotAllowedError.isStakingNotAllowedErrorDto(
                e.response?.data
              )
            ) {
              return new StakingNotAllowedError();
            }

            return new Error("Stake enter error");
          })
          .chain((actionDto) =>
            EitherAsync.liftEither(getValidStakeSessionTx(actionDto))
          )
      ).unsafeCoerce(),
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
      actionEnterGasEstimation.isLoading || gasCheckWarning.isLoading,
    depositFee,
    managementFee,
    performanceFee,
    feeConfigLoading: feeConfigDto.isPending,
  };
};

class StakingNotAllowedError extends Error {
  static isStakingNotAllowedErrorDto = (e: unknown) => {
    const dto = e as undefined | { type: string; code: number };

    return dto && dto.code === 422 && dto.type === "STAKING_ERROR";
  };

  constructor() {
    super("Staking not allowed, needs unstaking and trying again");
  }
}
