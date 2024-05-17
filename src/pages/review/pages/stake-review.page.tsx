import { Trans } from "react-i18next";
import { Highlight } from "../../../components";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useStakeReview } from "../hooks/use-stake-review.hook";
import { ReviewPage } from "./common.page";
import { useMemo } from "react";
import { Maybe } from "purify-ts";

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
    isGasCheckError,
    metaInfo,
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
      title={yieldType}
      metadata={metadata}
      token={token}
      info={info}
      rewardTokenDetailsProps={rewardTokenDetailsProps}
      isGasCheckError={isGasCheckError}
      {...metaInfo}
    />
  );
};
