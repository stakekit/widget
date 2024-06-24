import { withRequestErrorRetry } from "@sk-widget/common/utils";
import { getValidStakeSessionTx } from "@sk-widget/domain";
import { useStakeEnterData } from "@sk-widget/hooks/use-stake-enter-data";
import type { MetaInfoProps } from "@sk-widget/pages/review/pages/common.page";
import { useEnterStakeDispatch } from "@sk-widget/providers/enter-stake-state";
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
    enterRequest,
    gasCheckLoading,
    isGasCheckWarning,
    stakeEnterTxGas,
    stakeAmount,
  } = useStakeEnterData();

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
  const enterDispatch = useEnterStakeDispatch();

  const enterMutation = useMutation({
    mutationFn: async () => {
      return (
        await withRequestErrorRetry({
          fn: () => actionEnter(enterRequest.requestDto),
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
          .chain((actionDto) =>
            EitherAsync.liftEither(getValidStakeSessionTx(actionDto))
          )
          .ifRight((actionDto) =>
            enterDispatch((prev) =>
              prev.map((v) => ({ ...v, actionDto: Maybe.of(actionDto) }))
            )
          )
      ).unsafeCoerce();
    },
  });

  const onClick = () => enterMutation.mutate();

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
    isGasCheckWarning,
    gasCheckLoading,
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
