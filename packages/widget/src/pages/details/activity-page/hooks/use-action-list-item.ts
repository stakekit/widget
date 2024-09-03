import { useProvidersDetails } from "@sk-widget/hooks/use-provider-details";
import { getRewardRateFormatted } from "@sk-widget/utils/formatters";
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

  const rewardRateAverage = useMemo(
    () =>
      Maybe.fromRecord({ providersDetails, integrationData })
        .map((val) => ({
          ...val,
          rewardRateAverage: val.providersDetails
            .reduce(
              (acc, val) => acc.plus(new BigNumber(val.rewardRate || 0)),
              new BigNumber(0)
            )
            .dividedBy(val.providersDetails.length),
        }))
        .map((val) =>
          getRewardRateFormatted({
            rewardRate: val.rewardRateAverage.toNumber(),
            rewardType: val.integrationData.rewardType,
          })
        ),
    [integrationData, providersDetails]
  );

  return {
    integrationData,
    providersDetails,
    rewardRateAverage,
  };
};
