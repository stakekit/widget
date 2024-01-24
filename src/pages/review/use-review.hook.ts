import { useNavigate } from "react-router-dom";
import { getBaseToken, getTokenPriceInUSD } from "../../domain";
import { useSavedRef, useSelectedStakePrice } from "../../hooks";
import { Maybe } from "purify-ts";
import { formatNumber } from "../../utils";
import { useMemo } from "react";
import { useEstimatedRewards } from "../../hooks/use-estimated-rewards";
import { useYieldType } from "../../hooks/use-yield-type";
import { useRewardTokenDetails } from "../../hooks/use-reward-token-details";
import { useStakeState } from "../../state/stake";
import { useRegisterFooterButton } from "../components/footer-outlet/context";
import { useTranslation } from "react-i18next";

export const useReview = () => {
  const {
    stakeAmount,
    selectedStake,
    stakeEnterTxGas,
    selectedValidators,
    selectedTokenBalance,
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

  const gasFeeTokenNetwork = selectedStake.mapOrDefault(
    (y) => y.metadata.gasFeeToken.symbol,
    ""
  );
  const amount = formatNumber(stakeAmount);
  const interestRate = estimatedRewards.mapOrDefault(
    (r) => r.percentage.toString(),
    ""
  );

  const pricesState = useSelectedStakePrice({ selectedTokenBalance });

  const gasFeeInUSD = useMemo(
    () =>
      selectedStake
        .chain((ss) =>
          Maybe.fromNullable(pricesState.data).map((prices) => ({ prices, ss }))
        )
        .chain((val) => stakeEnterTxGas.map((gas) => ({ ...val, gas })))
        .map(({ prices, ss, gas }) =>
          getTokenPriceInUSD({
            amount: gas.toString(),
            prices,
            token: getBaseToken(ss.token),
            pricePerShare: undefined,
          })
        ),
    [selectedStake, pricesState.data, stakeEnterTxGas]
  );

  const fee = useMemo(
    () =>
      stakeEnterTxGas
        .chain((setg) => gasFeeInUSD.map((gfiu) => ({ setg, gfiu })))
        .mapOrDefault(
          ({ gfiu, setg }) =>
            `${formatNumber(setg)} ${gasFeeTokenNetwork} ($${formatNumber(
              gfiu
            )})`,
          ""
        ),
    [gasFeeInUSD, stakeEnterTxGas, gasFeeTokenNetwork]
  );

  const token = selectedStake.map((y) => y.token);
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

  return {
    amount,
    interestRate,
    fee,
    token,
    yieldType,
    rewardToken,
    metadata,
  };
};
