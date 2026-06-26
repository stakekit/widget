import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { getActionInputToken } from "../../../domain/types/action";
import type { TokenDto } from "../../../domain/types/tokens";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useYieldType } from "../../../hooks/use-yield-type";
import {
  useActivitySelectedAction,
  useActivitySelectedValidators,
  useActivitySelectedYield,
} from "../../../providers/activity-provider";
import { defaultFormattedNumber } from "../../../utils";

export const useActivityComplete = () => {
  useTrackPage("activityComplete");

  const selectedAction = useActivitySelectedAction().unsafeCoerce();

  const amount = useMemo(
    () =>
      Maybe.fromNullable(selectedAction.amount)
        .map(defaultFormattedNumber)
        .unsafeCoerce(),
    [selectedAction]
  );

  const selectedYield = useActivitySelectedYield();
  const selectedValidators = useActivitySelectedValidators();

  const yieldType = useYieldType(selectedYield).map((v) => v.type);

  const inputToken = useMemo(
    () =>
      Maybe.fromNullable(
        getActionInputToken({
          actionDto: selectedAction,
          yieldDto: selectedYield.extractNullable() ?? undefined,
        })
      ),
    [selectedAction, selectedYield]
  ) as Maybe<TokenDto>;

  const metadata = useMemo(
    () =>
      selectedYield.map((yieldDto) => ({
        logoURI: yieldDto.metadata.logoURI,
        name: yieldDto.metadata.name,
        provider: yieldDto.provider,
      })),
    [selectedYield]
  );

  const network = inputToken.mapOrDefault((y) => y.symbol, "");

  const providerDetails = useProvidersDetails({
    integrationData: selectedYield,
    validators: selectedValidators,
    selectedProviderYieldId: Maybe.of(selectedAction.yieldId),
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
