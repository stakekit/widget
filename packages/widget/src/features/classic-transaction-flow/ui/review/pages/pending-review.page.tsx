import { useTrackPage } from "../../../../tracking/state";
import { usePendingActionReview } from "../hooks/use-pending-review.hook.ts";
import { ReviewPage } from "./common-page/common.page.tsx";

export const PendingReviewPage = () => {
  const {
    amount,
    fee,
    integrationData,
    rewardTokenDetailsProps,
    title,
    token,
    metaInfo,
    gasCheckLoading,
    isGasCheckWarning,
    cta,
  } = usePendingActionReview();

  useTrackPage("pendingActionReview");

  return (
    <ReviewPage
      rewardTokenDetailsProps={rewardTokenDetailsProps}
      title={title}
      fee={fee}
      depositFee={null}
      managementFee={null}
      performanceFee={null}
      feeConfigLoading={false}
      info={`${amount} ${token.symbol}`}
      metadata={{
        logoURI: integrationData.metadata.logoURI,
        name: integrationData.metadata.name,
        provider: integrationData.provider,
      }}
      token={token}
      isGasCheckError={isGasCheckWarning}
      loading={gasCheckLoading}
      commissionFee={null}
      cta={cta}
      {...metaInfo}
    />
  );
};
