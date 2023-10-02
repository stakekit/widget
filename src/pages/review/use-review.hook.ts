import { useNavigate } from "react-router-dom";
import { getBaseToken, getTokenPriceInUSD } from "../../domain";
import { useSelectedStakePrice } from "../../hooks";
import { Maybe } from "purify-ts";
import { formatTokenBalance } from "../../utils";
import { useMemo } from "react";
import { Token } from "@stakekit/common";
import { useEstimatedRewards } from "../../hooks/use-estimated-rewards";
import { useYieldType } from "../../hooks/use-yield-type";
import { useRewardTokenDetails } from "../../hooks/use-reward-token-details";
import { useStakeState } from "../../state/stake";

export const useReview = () => {
  const {
    stakeAmount,
    selectedStake,
    stakeEnterTxGas,
    selectedValidator,
    selectedTokenBalance,
  } = useStakeState();

  const rewardToken = useRewardTokenDetails(selectedStake);
  const estimatedRewards = useEstimatedRewards({
    selectedStake,
    stakeAmount,
    selectedValidator,
  });
  const yieldType = useYieldType(selectedStake).mapOrDefault(
    (y) => y.review,
    ""
  );

  const tokenNetwork = selectedStake.mapOrDefault((y) => y.token.symbol, "");
  const amount = stakeAmount.mapOrDefault((a) => a.toString(), "");
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
            token: getBaseToken(ss.token as Token),
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
            `${formatTokenBalance(
              setg,
              6
            )} ${tokenNetwork} ($${formatTokenBalance(gfiu, 6)})`,
          ""
        ),
    [gasFeeInUSD, stakeEnterTxGas, tokenNetwork]
  );

  const token = selectedStake.map((y) => y.token).extractNullable();
  const metadata = selectedStake.map((y) => y.metadata).extractNullable();

  const navigate = useNavigate();

  const onClick = () => navigate("/steps");

  return {
    tokenNetwork,
    amount,
    interestRate,
    fee,
    token,
    yieldType,
    onClick,
    rewardToken,
    metadata,
  };
};