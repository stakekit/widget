import { useTrackPage } from "@sk-widget/hooks/tracking/use-track-page";
import { useProvidersDetails } from "@sk-widget/hooks/use-provider-details";
import { useYieldType } from "@sk-widget/hooks/use-yield-type";
import { useActivityContext } from "@sk-widget/providers/activity-provider";
import { defaultFormattedNumber } from "@sk-widget/utils";
import type { TokenDto } from "@stakekit/api-hooks";
import { useSelector } from "@xstate/store/react";
import { Maybe } from "purify-ts";
import { useMemo } from "react";

export const useActivityComplete = () => {
  useTrackPage("activityComplete");

  const activityContext = useActivityContext();

  const selectedAction = useSelector(
    activityContext,
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
    activityContext,
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
  });

  return {
    amount,
    yieldType,
    inputToken,
    metadata,
    network,
    providerDetails,
    selectedAction,
  };
};
