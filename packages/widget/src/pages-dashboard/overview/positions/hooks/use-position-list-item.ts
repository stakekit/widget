import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { config } from "../../../../config";
import { getTokenPriceInUSD } from "../../../../domain";
import { usePrices } from "../../../../hooks/api/use-prices";
import { useRewardsSummary } from "../../../../hooks/use-rewards-summary";
import { usePositionListItem as useBasePositionListItem } from "../../../../pages/details/positions-page/hooks/use-position-list-item";
import type { usePositions } from "../../../../pages/details/positions-page/hooks/use-positions";
import { defaultFormattedNumber, formatNumber } from "../../../../utils";

export const usePositionListItem = (
  item: ReturnType<typeof usePositions>["positionsData"]["data"][number]
) => {
  const {
    integrationData,
    providersDetails,
    rewardRateAverage,
    inactiveValidator,
    baseToken,
    totalAmount,
    totalAmountFormatted,
    tokenToDisplay,
  } = useBasePositionListItem(item);

  const rewardsSummaryQuery = useRewardsSummary(item.integrationId);

  const rewardsSummary = useMemo(
    () =>
      Maybe.fromNullable(rewardsSummaryQuery.data?.data).filter((val) =>
        BigNumber(val.rewards.total).gt(0)
      ),
    [rewardsSummaryQuery.data]
  );

  const prices = usePrices({
    currency: config.currency,
    tokenList: [
      ...baseToken.mapOrDefault((v) => [v], []),
      ...tokenToDisplay.mapOrDefault((v) => [v], []),
      ...rewardsSummary.mapOrDefault((v) => [v.token], []),
    ],
  });

  const rewardsAmountFormatted = useMemo(
    () =>
      rewardsSummary
        .map((val) => BigNumber(val.rewards.total))
        .map(defaultFormattedNumber),
    [rewardsSummary]
  );

  const totalAmountPriceFormatted = useMemo(
    () =>
      Maybe.fromRecord({
        totalAmount,
        baseToken,
        prices: Maybe.fromNullable(prices.data),
        tokenToDisplay,
      })
        .map((val) =>
          getTokenPriceInUSD({
            baseToken: val.baseToken,
            amount: val.totalAmount,
            pricePerShare: val.tokenToDisplay.pricePerShare,
            token: val.tokenToDisplay,
            prices: val.prices,
          })
        )
        .map((v) => formatNumber(v, 2)),
    [totalAmount, baseToken, prices, tokenToDisplay]
  );

  const rewardsAmountPriceFormatted = useMemo(
    () =>
      Maybe.fromRecord({
        baseToken,
        rewardsSummary,
        prices: Maybe.fromNullable(prices.data),
      })
        .map((val) =>
          getTokenPriceInUSD({
            baseToken: val.baseToken,
            amount: val.rewardsSummary.rewards.total,
            pricePerShare: null,
            token: val.rewardsSummary.token,
            prices: val.prices,
          })
        )
        .map((v) => formatNumber(v, 2)),
    [rewardsSummary, baseToken, prices]
  );

  return {
    integrationData,
    providersDetails,
    rewardRateAverage,
    inactiveValidator,
    totalAmountFormatted,
    totalAmountPriceFormatted,
    rewardsAmountFormatted,
    rewardsAmountPriceFormatted,
  };
};
