import { useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useMemo } from "react";
import { getTokenPriceInUSD } from "../../../../../../domain/finance/price";
import {
  PricesKey,
  pricesAtom,
} from "../../../../../../resources/token-prices/prices";
import { config } from "../../../../../../shared/config/widget-defaults";
import { defaultFormattedNumber } from "../../../../../../shared/lib/number-format";
import {
  CurrentRewardsSummaryKey,
  currentRewardsSummaryAtom,
} from "../../../../../yield-summary/state";
import type { PositionItem } from "../../../../state/read-models/positions";
import { usePositionListItem as useBasePositionListItem } from "../../../classic/positions-page/hooks/use-position-list-item";

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
      pricesAtom.foreground(
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
