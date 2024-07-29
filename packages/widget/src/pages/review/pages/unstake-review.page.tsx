import { UnstakeSignPopup } from "@sk-widget/pages/position-details/components/unstake-sign-popup";
import { useUnstakeActionReview } from "@sk-widget/pages/review/hooks/use-unstake-review.hook";
import { Maybe } from "purify-ts";
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
    depositFee,
    managementFee,
    performanceFee,
    feeConfigLoading,
  } = useUnstakeActionReview();

  useTrackPage("unstakeReview");

  const info = useMemo(
    () =>
      Maybe.fromRecord({ token, amount })
        .map((val) => `${val.amount} ${val.token.symbol}`)
        .extractNullable(),
    [amount, token]
  );

  return (
    <>
      <ReviewPage
        rewardTokenDetailsProps={rewardTokenDetailsProps}
        title={title.orDefault("")}
        fee={fee}
        depositFee={depositFee}
        managementFee={managementFee}
        performanceFee={performanceFee}
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
