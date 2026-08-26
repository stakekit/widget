import { useMemo } from "react";
import { Trans } from "react-i18next";
import { Highlight } from "../../../../../shared/ui/primitives/highlight";
import { useTrackPage } from "../../../../tracking/index";
import { KycGateCard } from "../../../../yield-summary/views";
import { useStakeReview } from "../hooks/use-stake-review.hook";
import { ReviewPage } from "./common-page/common.page.tsx";

export const StakeReviewPage = () => {
  useTrackPage("stakeReview");

  const {
    fee,
    yieldType,
    amount,
    interestRate,
    estimatedRewardAmounts,
    metadata,
    rewardToken,
    token,
    metaInfo,
    gasCheckLoading,
    isGasCheckWarning,
    depositFee,
    managementFee,
    performanceFee,
    feeConfigLoading,
    commissionFee,
    kycGate,
    kycProviderName,
    kycStatusIsChecking,
    onKycStatusRefresh,
    cta,
  } = useStakeReview();

  const info = useMemo(() => {
    return token ? (
      <Trans
        i18nKey="review.amount_and_earn"
        values={{
          amount,
          tokenSymbol: token.symbol,
          interestRate,
        }}
        components={{
          highlight0: <Highlight />,
          highlight1: <Highlight />,
          highlight3: <Highlight />,
        }}
      />
    ) : null;
  }, [amount, interestRate, token]);

  const rewardTokenDetailsProps = {
    rewardToken,
    type: "stake" as const,
  };

  return (
    <ReviewPage
      fee={fee}
      depositFee={depositFee}
      managementFee={managementFee}
      performanceFee={performanceFee}
      feeConfigLoading={feeConfigLoading}
      title={yieldType}
      metadata={metadata}
      token={token}
      info={info}
      rewardTokenDetailsProps={rewardTokenDetailsProps}
      estimatedRewardAmounts={estimatedRewardAmounts}
      isGasCheckError={isGasCheckWarning}
      loading={gasCheckLoading}
      commissionFee={commissionFee}
      cta={cta}
      notice={
        kycGate.state !== "pass" || kycStatusIsChecking ? (
          <KycGateCard
            gate={kycGate}
            isChecking={kycStatusIsChecking}
            onCheckStatus={onKycStatusRefresh}
            providerName={kycProviderName}
          />
        ) : null
      }
      {...metaInfo}
    />
  );
};
