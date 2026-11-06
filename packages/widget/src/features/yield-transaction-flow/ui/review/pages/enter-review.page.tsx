import { useTrackPage } from "../../../../tracking/index";
import { useEnterReview } from "../hooks/use-enter-review.hook";
import { ReviewPage } from "./common.page.tsx";

export const EnterReviewPage = () => {
  useTrackPage("stakeReview");

  const {
    fee,
    yieldType,
    amount,
    amountFiat,
    destination,
    facts,
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

  return (
    <ReviewPage
      fee={fee}
      depositFee={depositFee}
      managementFee={managementFee}
      performanceFee={performanceFee}
      feeConfigLoading={feeConfigLoading}
      title={yieldType}
      token={token}
      amount={`${amount} ${token.symbol}`}
      amountFiat={amountFiat}
      destination={destination}
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
