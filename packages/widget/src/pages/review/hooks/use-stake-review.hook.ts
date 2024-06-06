import { useStakeEnterData } from "@sk-widget/hooks/use-stake-enter-data";
import type { MetaInfoProps } from "@sk-widget/pages/review/pages/common.page";
import { useSettings } from "@sk-widget/providers/settings";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
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
  const { isGasCheckError, stakeEnterData, stakeEnterTxGas } =
    useStakeEnterData();

  const selectedStake = stakeEnterData.map((val) => val.selectedStake);
  const stakeAmount = stakeEnterData.mapOrDefault(
    (val) => val.stakeAmount,
    new BigNumber(0)
  );
  const selectedValidators = stakeEnterData.mapOrDefault(
    (val) => val.selectedValidators,
    new Map()
  );
  const selectedToken = stakeEnterData.map((val) => val.selectedToken);

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
    amount,
    interestRate,
    fee,
    token: selectedToken,
    yieldType,
    rewardToken,
    metadata,
    isGasCheckError,
    metaInfo,
  };
};
