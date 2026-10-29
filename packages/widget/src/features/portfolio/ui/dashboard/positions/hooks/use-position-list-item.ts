import { useAtomValue } from "@effect/atom-react";
import { getTokenPriceInUSD } from "../../../../../../domain/finance/price";
import { PricesKey } from "../../../../../../resources/token-prices/index";
import { config } from "../../../../../../shared/config/widget-defaults";
import { formatTokenAmount } from "../../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../../shared/ui/widget-presentation";
import {
  CurrentRewardsSummaryKey,
  currentRewardsSummaryAtom,
} from "../../../../../yield-summary/index";
import { usePositionListItem as useBasePositionListItem } from "../../../../react/use-position-list-item";
import { positionPricesAtom } from "../../../../state/read-models/position-list-item";
import type { PositionItem } from "../../../../state/read-models/positions";

export const usePositionListItem = (item: PositionItem) => {
  const { locale } = useWidgetPresentation();
  const {
    integrationData,
    providersDetails,
    rewardRateAverage,
    inactiveValidator,
    baseToken,
    totalAmountFormatted,
    totalAmountUsd,
  } = useBasePositionListItem(item);

  const rewardsSummaries = useAtomValue(
    currentRewardsSummaryAtom(
      new CurrentRewardsSummaryKey({
        yieldIds: [item.integrationId],
      })
    )
  );

  const summary =
    rewardsSummaries._tag === "Ready"
      ? rewardsSummaries.value?.[item.integrationId]
      : undefined;
  const rewardsSummary = summary?.rewards.total.gt(0) ? summary : null;

  const pricesView = useAtomValue(
    positionPricesAtom(
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
  );
  const prices = pricesView._tag === "Ready" ? pricesView.value : null;

  const rewardsAmountFormatted = rewardsSummary
    ? formatTokenAmount(rewardsSummary.rewards.total, locale, "down")
    : null;

  const rewardsAmountPriceFormatted =
    baseToken && rewardsSummary && prices
      ? formatTokenAmount(
          getTokenPriceInUSD({
            baseToken,
            amount: rewardsSummary.rewards.total,
            pricePerShare: null,
            token: rewardsSummary.token,
            prices,
          }),
          locale,
          "down"
        )
      : null;

  return {
    hasHiddenBalance: item.balancesWithAmount.some(
      (balance) => balance.isEncrypted
    ),
    integrationData,
    providersDetails,
    rewardRateAverage,
    inactiveValidator,
    totalAmountFormatted,
    totalAmountUsd,
    rewardsAmountFormatted,
    rewardsAmountPriceFormatted,
  };
};
