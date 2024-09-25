import { useProvidersDetails } from "@sk-widget/hooks/use-provider-details";
import { capitalizeFirstLetters } from "@sk-widget/utils/formatters";
import type { ActionDto, YieldDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
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

  const actionType = useMemo(
    () =>
      Maybe.of(action.actionData.type)
        .map((t) => t.replaceAll("_", " "))
        .map(capitalizeFirstLetters)
        .extract(),
    [action]
  );

  const amount = useMemo(
    () =>
      Maybe.fromNullable(action.actionData.amount)
        .map(BigNumber)
        .map((a) => a.toString(10)),
    [action]
  );

  return {
    integrationData,
    providersDetails,
    actionType,
    amount,
  };
};
