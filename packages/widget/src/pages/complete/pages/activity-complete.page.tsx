import { useProvidersDetails } from "@sk-widget/hooks/use-provider-details";
import { useYieldType } from "@sk-widget/hooks/use-yield-type";
import { CompletePage } from "@sk-widget/pages/complete/pages/common.page";
import { useActivityContext } from "@sk-widget/providers/activity-provider";
import { formatNumber } from "@sk-widget/utils";
import { useSelector } from "@xstate/store/react";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";

export const ActivityCompletePage = () => {
  useTrackPage("activityComplete");

  const selectedAction = useSelector(
    useActivityContext(),
    (state) => state.context.selectedAction
  ).unsafeCoerce();

  const amount = useMemo(
    () =>
      Maybe.fromNullable(selectedAction.amount)
        .map((a) => new BigNumber(a))
        .map(formatNumber)
        .unsafeCoerce(),
    [selectedAction]
  );

  const selectedYield = useSelector(
    useActivityContext(),
    (state) => state.context.selectedYield
  );

  const yieldType = useYieldType(selectedYield).map((v) => v.type);

  const token = useMemo(
    () => selectedYield.map((y) => y.token),
    [selectedYield]
  );

  const metadata = useMemo(
    () => selectedYield.map((y) => y.metadata),
    [selectedYield]
  );

  const network = useMemo(
    () => selectedYield.map((a) => a.token.network).unsafeCoerce(),
    [selectedYield]
  );

  const providerDetails = useProvidersDetails({
    integrationData: selectedYield,
    validatorsAddresses: Maybe.of(selectedAction.validatorAddresses ?? []),
  });

  return (
    <CompletePage
      yieldType={yieldType}
      providersDetails={providerDetails}
      token={token}
      metadata={metadata}
      network={network}
      amount={amount}
    />
  );
};
