import { useProvidersDetails } from "@sk-widget/hooks/use-provider-details";
import { useYieldType } from "@sk-widget/hooks/use-yield-type";
import { CompletePage } from "@sk-widget/pages/complete/pages/common.page";
import { useActivityContext } from "@sk-widget/providers/activity-provider";
import { defaultFormattedNumber } from "@sk-widget/utils";
import type { TokenDto } from "@stakekit/api-hooks";
import { useSelector } from "@xstate/store/react";
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
        .map(defaultFormattedNumber)
        .unsafeCoerce(),
    [selectedAction]
  );

  const selectedYield = useSelector(
    useActivityContext(),
    (state) => state.context.selectedYield
  );

  const yieldType = useYieldType(selectedYield).map((v) => v.type);

  const inputToken = useMemo(
    () => Maybe.fromNullable(selectedAction).map((y) => y.inputToken),
    [selectedAction]
  ) as Maybe<TokenDto>;

  const metadata = useMemo(
    () => selectedYield.map((y) => y.metadata),
    [selectedYield]
  );

  const network = inputToken.mapOrDefault((y) => y.symbol, "");

  const providerDetails = useProvidersDetails({
    integrationData: selectedYield,
    validatorsAddresses: Maybe.of(selectedAction.validatorAddresses ?? []),
    selectedProviderYieldId: Maybe.empty(),
  });

  return (
    <CompletePage
      yieldType={yieldType}
      providersDetails={providerDetails}
      token={inputToken}
      metadata={metadata}
      network={network}
      amount={amount}
      pendingActionType={selectedAction.type}
      integrationId={selectedAction.integrationId}
    />
  );
};
