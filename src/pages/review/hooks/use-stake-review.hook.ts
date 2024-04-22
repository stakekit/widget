import { useNavigate } from "react-router-dom";
import { useSavedRef, useSelectedStakePrice } from "../../../hooks";
import { Maybe } from "purify-ts";
import { formatNumber } from "../../../utils";
import { useMemo } from "react";
import { useEstimatedRewards } from "../../../hooks/use-estimated-rewards";
import { useYieldType } from "../../../hooks/use-yield-type";
import { useRewardTokenDetails } from "../../../hooks/use-reward-token-details";
import { useStakeState } from "../../../state/stake";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";
import { useTranslation } from "react-i18next";
import { getGasFeeInUSD } from "../../../utils/formatters";

export const useStakeReview = () => {
  const {
    stakeAmount,
    selectedStake,
    stakeEnterTxGas,
    selectedValidators,
    selectedTokenBalance,
    isGasCheckError,
  } = useStakeState();

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

  const pricesState = useSelectedStakePrice({ selectedTokenBalance });

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

  const token = selectedTokenBalance.map((y) => y.token);

  const navigate = useNavigate();

  const onClick = () => navigate("/steps");

  const onClickRef = useSavedRef(onClick);

  const { t } = useTranslation();

  useRegisterFooterButton(
    useMemo(
      () => ({
        disabled: false,
        isLoading: false,
        label: t("shared.confirm"),
        onClick: () => onClickRef.current(),
      }),
      [onClickRef, t]
    )
  );

  return {
    amount,
    interestRate,
    fee,
    token,
    yieldType,
    rewardToken,
    metadata,
    isGasCheckError,
  };
};
