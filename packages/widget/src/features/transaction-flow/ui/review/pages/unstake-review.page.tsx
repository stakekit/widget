import { KycGateCard } from "../../../../earn/ui/components/kyc-gate-card";
import { UnstakeSignPopup } from "../../../../position-details/ui/classic/components/unstake-sign-popup";
import { useTrackPage } from "../../../../tracking/react/use-track-page";
import { ClassicFlowStepsNavigation } from "../../../react/classic-flow-navigation";
import { useUnstakeActionReview } from "../hooks/use-unstake-review.hook";
import { ReviewPage } from "./common-page/common.page";

export const UnstakeReviewPage = () => {
  const {
    amount,
    fee,
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
      <ClassicFlowStepsNavigation />
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
