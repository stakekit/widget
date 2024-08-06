import { UnstakeSignPopup } from "@sk-widget/pages/position-details/components/unstake-sign-popup";
import { useUnstakeActionReview } from "@sk-widget/pages/review/hooks/use-unstake-review.hook";
import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { ReviewPage } from "./common.page";

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
    depositFeeUSD,
    managementFeeUSD,
    performanceFeeUSD,
    feeConfigLoading,
  } = useUnstakeActionReview();

  useTrackPage("unstakeReview");

  const info = useMemo(
    () => token.map((val) => `${amount} ${val.symbol}`).extractNullable(),
    [amount, token]
  );

  return (
    <>
      <ReviewPage
        rewardTokenDetailsProps={rewardTokenDetailsProps}
        title={title.orDefault("")}
        fee={fee}
        depositFeeUSD={depositFeeUSD}
        managementFeeUSD={managementFeeUSD}
        performanceFeeUSD={performanceFeeUSD}
        feeConfigLoading={feeConfigLoading}
        info={info}
        metadata={integrationData.map((d) => d.metadata)}
        token={token}
        isGasCheckError={isGasCheckWarning}
        loading={gasCheckLoading}
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
