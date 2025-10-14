import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { UnstakeSignPopup } from "../../position-details/components/unstake-sign-popup";
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
  } = useUnstakeActionReview();

  useTrackPage("unstakeReview");

  const info = useMemo(
    () => token.map((val) => `${amount} ${val.symbol}`).extractNullable(),
    [amount, token]
  );

  const { depositFee, managementFee, performanceFee, feeConfigLoading } =
    useMemo(
      () => ({
        depositFee: Maybe.empty(),
        managementFee: Maybe.empty(),
        performanceFee: Maybe.empty(),
        feeConfigLoading: false,
      }),
      []
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
        commissionFee={Maybe.empty()}
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
