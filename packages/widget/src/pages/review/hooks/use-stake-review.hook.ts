import { withRequestErrorRetry } from "@sk-widget/common/utils";
import { getValidStakeSessionTx } from "@sk-widget/domain";
import { useStakeEnterData } from "@sk-widget/hooks/use-stake-enter-data";
import type { MetaInfoProps } from "@sk-widget/pages/review/pages/common.page";
import { useEnterStakeRequestDtoDispatch } from "@sk-widget/providers/enter-stake-request-dto";
import { useSettings } from "@sk-widget/providers/settings";
import { useActionEnterHook } from "@stakekit/api-hooks";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { EitherAsync, Maybe } from "purify-ts";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSavedRef, useTokensPrices } from "../../../hooks";
import { useEstimatedRewards } from "../../../hooks/use-estimated-rewards";
import { useRewardTokenDetails } from "../../../hooks/use-reward-token-details";
import { useYieldType } from "../../../hooks/use-yield-type";
import { formatNumber } from "../../../utils";
import { getGasFeeInUSD } from "../../../utils/formatters";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";

export const useStakeReview = () => {
  const {
    selectedStake,
    selectedValidators,
    selectedToken,
    stakeEnterTxGas,
    stakeAmount,
    enterRequestDto,
    isGasCheckError,
    gasEstimatePending,
  } = useStakeEnterData();

  const rewardToken = useRewardTokenDetails(selectedStake);
  const estimatedRewards = useEstimatedRewards({
    selectedStake,
    stakeAmount,
    selectedValidators,
  });
  const yieldType = useYieldType(selectedStake).mapOrDefault(
    (y) => y.review,
    ""
  );

  const amount = formatNumber(stakeAmount);
  const interestRate = estimatedRewards.mapOrDefault(
    (r) => r.percentage.toString(),
    ""
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

  const metadata = selectedStake.map((y) => y.metadata);

  const navigate = useNavigate();
  const actionEnter = useActionEnterHook();
  const setEnterDto = useEnterStakeRequestDtoDispatch();

  const enterMutation = useMutation({
    mutationFn: async () => {
      return (
        await withRequestErrorRetry({
          fn: () => actionEnter(enterRequestDto.dto),
        })
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
          .chain((actionDto) => {
            const a = EitherAsync.liftEither(getValidStakeSessionTx(actionDto));
            return a;
          })
      ).unsafeCoerce();
    },
  });

  const onClick = async () => {
    const mutate = await enterMutation.mutateAsync();
    Maybe.fromNullable(mutate).map((val) => {
      // CHECK THIS => prev && { ...prev, val }
      setEnterDto((prev) => prev && { ...prev, actionDto: val });
    });
  };

  useEffect(() => {
    enterMutation.isSuccess && navigate("/steps");
  }, [enterMutation.isSuccess, navigate]);

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

  const metaInfo: MetaInfoProps = useMemo(
    () =>
      variant === "zerion"
        ? {
            showMetaInfo: true,
            metaInfoProps: {
              selectedStake,
              selectedToken,
              selectedValidators,
            },
          }
        : { showMetaInfo: false },
    [selectedStake, selectedToken, selectedValidators, variant]
  );

  return {
    token: selectedToken,
    amount,
    isGasCheckError,
    fee,
    interestRate,
    yieldType,
    rewardToken,
    metadata,
    metaInfo,
    gasEstimatePending,
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
