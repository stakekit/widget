import { useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useMemo } from "react";
import { config } from "../../../../config";
import { getTokenPriceInUSD } from "../../../../domain";
import {
  CurrentRewardsSummaryKey,
  currentRewardsSummaryAtom,
} from "../../../../hooks/api/dashboard-atoms";
import type { PositionItem } from "../../../../hooks/api/position-atoms";
import { PricesKey, pricesAtom } from "../../../../hooks/api/prices-atoms";
import { usePositionListItem as useBasePositionListItem } from "../../../../pages/details/positions-page/hooks/use-position-list-item";
import { defaultFormattedNumber } from "../../../../utils";

export const usePositionListItem = (item: PositionItem) => {
  const {
    integrationData,
    providersDetails,
    rewardRateAverage,
    inactiveValidator,
    baseToken,
    totalAmountFormatted,
    totalAmountPriceFormatted,
  } = useBasePositionListItem(item);

  const rewardsSummaries = AsyncResult.getOrElse(
    useAtomValue(
      currentRewardsSummaryAtom(
        new CurrentRewardsSummaryKey({
          enabled: true,
          yieldIds: [item.integrationId],
        })
      )
    ),
    () => null
  );

  const rewardsSummary = useMemo(() => {
    const summary = rewardsSummaries?.[item.integrationId];

    return summary && BigNumber(summary.rewards.total).gt(0) ? summary : null;
  }, [item.integrationId, rewardsSummaries]);

  const prices = AsyncResult.getOrElse(
    useAtomValue(
      pricesAtom(
        new PricesKey({
          request: {
            currency: config.currency,
            tokenList: [
              ...(baseToken ? [baseToken] : []),
              ...(rewardsSummary ? [rewardsSummary.token] : []),
            ],
          },
        })
      )
    ),
    () => null
  );

  const rewardsAmountFormatted = useMemo(
    () =>
      rewardsSummary
        ? defaultFormattedNumber(BigNumber(rewardsSummary.rewards.total))
        : null,
    [rewardsSummary]
  );

  const rewardsAmountPriceFormatted = useMemo(
    () =>
      baseToken && rewardsSummary && prices
        ? defaultFormattedNumber(
            getTokenPriceInUSD({
              baseToken,
              amount: rewardsSummary.rewards.total,
              pricePerShare: null,
              token: rewardsSummary.token,
              prices,
            })
          )
        : null,
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
