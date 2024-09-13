import { useProvidersDetails } from "@sk-widget/hooks/use-provider-details";
import type { ActionDto, YieldDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { useMemo } from "react";

type ActionYieldDto = {
  actionData: ActionDto;
  yieldData: YieldDto;
};

export const useActionListItem = (action: ActionYieldDto) => {
  const integrationData = useMemo(
    () => Maybe.fromNullable(action.yieldData),
    [action.yieldData]
  );

  const providersDetails = useProvidersDetails({
    integrationData,
    validatorsAddresses: Maybe.of(action.actionData.validatorAddresses ?? []),
  });

  return {
    integrationData,
    providersDetails,
  };
};
