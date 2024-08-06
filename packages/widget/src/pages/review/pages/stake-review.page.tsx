import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { Trans } from "react-i18next";
import { Highlight } from "../../../components";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useStakeReview } from "../hooks/use-stake-review.hook";
import { ReviewPage } from "./common.page";

export const StakeReviewPage = () => {
  useTrackPage("stakeReview");

  const {
    fee,
    yieldType,
    amount,
    interestRate,
    metadata,
    rewardToken,
    token,
    metaInfo,
    gasCheckLoading,
    isGasCheckWarning,
    depositFeeUSD,
    managementFeeUSD,
    performanceFeeUSD,
    feeConfigLoading,
  } = useStakeReview();

  const info = useMemo(
    () =>
      token
        .map((t) => (
          <Trans
            i18nKey="review.amount_and_earn"
            values={{
              amount,
              tokenSymbol: t.symbol,
              interestRate,
            }}
            components={{
              highlight0: <Highlight />,
              highlight1: <Highlight />,
              highlight3: <Highlight />,
            }}
          />
        ))
        .extractNullable(),
    [amount, interestRate, token]
  );

  const rewardTokenDetailsProps = useMemo(
    () => Maybe.of({ rewardToken, type: "stake" as const }),
    [rewardToken]
  );

  return (
    <ReviewPage
      fee={fee}
      depositFeeUSD={depositFeeUSD}
      managementFeeUSD={managementFeeUSD}
      performanceFeeUSD={performanceFeeUSD}
      feeConfigLoading={feeConfigLoading}
      title={yieldType}
      metadata={metadata}
      token={token}
      info={info}
      rewardTokenDetailsProps={rewardTokenDetailsProps}
      isGasCheckError={isGasCheckWarning}
      loading={gasCheckLoading}
      {...metaInfo}
    />
  );
};
