import { equalTokens, getBaseToken } from "@sk-widget/domain";
import { useYieldOpportunity } from "@sk-widget/hooks/api/use-yield-opportunity";
import { useProvidersDetails } from "@sk-widget/hooks/use-provider-details";
import type { usePositions } from "@sk-widget/pages/details/positions-page/hooks/use-positions";
import { defaultFormattedNumber } from "@sk-widget/utils";
import { getRewardRateFormatted } from "@sk-widget/utils/formatters";
import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";

export const usePositionListItem = (
  item: ReturnType<typeof usePositions>["positionsData"]["data"][number]
) => {
  const yieldOpportunity = useYieldOpportunity(item.integrationId);
  const integrationData = useMemo(
    () => Maybe.fromNullable(yieldOpportunity.data),
    [yieldOpportunity.data]
  );

  const providersDetails = useProvidersDetails({
    integrationData,
    validatorsAddresses: Maybe.of(
      item.type === "validators" ? item.validatorsAddresses : []
    ),
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

  const inactiveValidator = useMemo(
    () =>
      providersDetails
        .chain((val) => List.find((v) => v.status !== "active", val))
        .chainNullable((val) => val.status)
        .map((v) => v as Exclude<typeof v, "active">)
        .extractNullable(),
    [providersDetails]
  );

  const tokenToDisplay = item.token;
  const baseToken = useMemo(
    () => integrationData.map((y) => getBaseToken(y)),
    [integrationData]
  );

  const amount = useMemo(
    () =>
      Maybe.fromRecord({
        tokenToDisplay,
        baseToken,
      })
        .map((val) =>
          item.balancesWithAmount.reduce((acc, b) => {
            if (b.token.isPoints) return acc;

            if (equalTokens(b.token, val.tokenToDisplay)) {
              return new BigNumber(b.amount).plus(acc);
            }

            return new BigNumber(b.amount)
              .times(b.pricePerShare)
              .dividedBy(val.tokenToDisplay.pricePerShare)
              .plus(acc);
          }, new BigNumber(0))
        )
        .map(defaultFormattedNumber),
    [item.balancesWithAmount, tokenToDisplay, baseToken]
  );

  return {
    integrationData,
    providersDetails,
    rewardRateAverage,
    inactiveValidator,
    amount,
  };
};
