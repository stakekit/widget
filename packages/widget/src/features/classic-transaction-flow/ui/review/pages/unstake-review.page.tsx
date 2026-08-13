import { KycGateCard } from "../../../../earn/components";
import { UnstakeSignPopup } from "../../../../position-details/ui";
import { useTrackPage } from "../../../../tracking/state";
import { useUnstakeActionReview } from "../hooks/use-unstake-review.hook.ts";
import { ReviewPage } from "./common-page/common.page.tsx";

export const UnstakeReviewPage = () => {
  const {
    amount,
    fee,
    facts,
    integrationData,
    rewardTokenDetailsProps,
    title,
    token,
    metaInfo,
    onContinueUnstakeSignMessage,
    onCloseUnstakeSignMessage,
    showUnstakeSignMessagePopup,
    gasCheckLoading,
    isGasCheckWarning,
    kycGate,
    kycProviderName,
    kycStatusIsChecking,
    onKycStatusRefresh,
    cta,
  } = useUnstakeActionReview();

  useTrackPage("unstakeReview");

  return (
    <>
      <ReviewPage
        facts={facts}
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
      <UnstakeSignPopup
        isOpen={showUnstakeSignMessagePopup}
        onClick={onContinueUnstakeSignMessage}
        onCancel={onCloseUnstakeSignMessage}
      />
    </>
  );
};
