import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
import { getBaseToken } from "../../../../domain";
import { getPositionTotalAmount } from "../../../../domain/types/positions";
import { useYieldOpportunity } from "../../../../hooks/api/use-yield-opportunity";
import { useProvidersDetails } from "../../../../hooks/use-provider-details";
import { formatNumber } from "../../../../utils";
import { getRewardRateFormatted } from "../../../../utils/formatters";
import type { usePositions } from "./use-positions";

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
    selectedProviderYieldId: Maybe.empty(),
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

  const totalAmount = useMemo(
    () =>
      tokenToDisplay.map((val) =>
        getPositionTotalAmount({
          token: val,
          balances: item.balancesWithAmount,
        })
      ),
    [item.balancesWithAmount, tokenToDisplay]
  );

  const totalAmountFormatted = useMemo(
    () => totalAmount.map((v) => formatNumber(v, 2)),
    [totalAmount]
  );

  return {
    integrationData,
    providersDetails,
    rewardRateAverage,
    inactiveValidator,
    totalAmount,
    totalAmountFormatted,
    baseToken,
    tokenToDisplay,
  };
};
