import { useTranslation } from "react-i18next";
import { useTrackPage } from "../../../../tracking/index";
import { useEnterReview } from "../hooks/use-enter-review.hook";
import { ReviewPage } from "./common.page.tsx";
import type { ReviewFact } from "./review-overview";

export const EnterReviewPage = () => {
  useTrackPage("stakeReview");

  const { t } = useTranslation();
  const {
    fee,
    yieldType,
    amount,
    interestRate,
    estimatedRewardAmounts,
    metadata,
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
  } = useEnterReview();

  const facts: ReadonlyArray<ReviewFact> = estimatedRewardAmounts
    ? [
        {
          label: t("review.estimated_yearly_rewards"),
          testId: "estimated-reward__yearly",
          hostHook: "estimated-reward__yearly",
          value: estimatedRewardAmounts.earnYearly,
        },
        {
          label: t("review.estimated_monthly_rewards"),
          testId: "estimated-reward__monthly",
          hostHook: "estimated-reward__monthly",
          value: estimatedRewardAmounts.earnMonthly,
        },
      ]
    : [];

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
      amount={`${amount} ${token.symbol}`}
      destination={
        interestRate ? t("review.and_earn", { interestRate }) : undefined
      }
      facts={facts}
      isGasCheckError={isGasCheckWarning}
      loading={gasCheckLoading}
      commissionFee={commissionFee}
      cta={cta}
      kyc={{
        gate: kycGate,
        isChecking: kycStatusIsChecking,
        onCheckStatus: onKycStatusRefresh,
        providerName: kycProviderName,
      }}
      {...metaInfo}
    />
  );
};
