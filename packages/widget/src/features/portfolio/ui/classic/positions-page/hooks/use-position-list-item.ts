import { useAtomValue } from "@effect/atom-react";
import { exactZero } from "../../../../../../domain/finance/exact";
import { getPositionTotalAmount } from "../../../../../../domain/portfolio/positions";
import {
  formatRewardRatePercent,
  formatTokenAmount,
} from "../../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../../shared/ui/widget-presentation";
import {
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../../../yield-summary/index";
import { positionYieldAtom } from "../../../../state/read-models/position-list-item";
import type { PositionItem } from "../../../../state/read-models/positions";

export const usePositionListItem = (item: PositionItem) => {
  const { locale } = useWidgetPresentation();
  const positionYield = useAtomValue(positionYieldAtom(item.integrationId));
  const integrationData =
    positionYield._tag === "Ready" ? positionYield.value : null;

  const providersDetails = useAtomValue(
    yieldSummaryAtom(
      new YieldSummaryKey({
        yield: integrationData,
        validators: item.type === "validators" ? item.validators : [],
      })
    )
  ).providers;

  const rewardRateAverage =
    providersDetails && integrationData
      ? formatRewardRatePercent(
          providersDetails
            .reduce(
              (acc, val) => acc.plus(val.rewardRate ?? exactZero()),
              exactZero()
            )
            .dividedBy(providersDetails.length),
          locale
        )
      : null;

  const inactiveValidator = providersDetails?.find(
    (provider) => provider.status !== "active"
  )?.status as Exclude<
    NonNullable<NonNullable<typeof providersDetails>[number]["status"]>,
    "active"
  > | null;

  const tokenToDisplay = item.token;
  const baseToken = integrationData?.token ?? null;

  const amounts = baseToken
    ? getPositionTotalAmount(item.balancesWithAmount, baseToken)
    : null;

  const totalAmount = amounts?.amount ?? null;

  const amountUsd = amounts?.amountUsd ?? null;
  const totalAmountUsd = amountUsd?.isGreaterThan(0) ? amountUsd : null;

  const totalAmountFormatted = totalAmount
    ? formatTokenAmount(totalAmount, locale, "down")
    : null;

  return {
    hasHiddenBalance: item.balancesWithAmount.some(
      (balance) => balance.isEncrypted
    ),
    integrationData,
    providersDetails,
    rewardRateAverage,
    inactiveValidator,
    totalAmount,
    totalAmountUsd,
    totalAmountFormatted,
    baseToken,
    tokenToDisplay,
  };
};
