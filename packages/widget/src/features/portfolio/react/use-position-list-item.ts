import { useAtomValue } from "@effect/atom-react";
import { exactZero } from "../../../domain/finance/exact";
import { toInactiveValidatorStatus } from "../../../domain/portfolio/position-callout";
import {
  formatRewardRatePercent,
  formatShortTokenAmountWithSymbol,
  formatUsd,
} from "../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import { YieldSummaryKey, yieldSummaryAtom } from "../../yield-summary/index";
import {
  positionYieldAtom,
  toPositionTotalDisplay,
} from "../state/read-models/position-list-item";
import type { PositionItem } from "../state/read-models/positions";

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

  // The rate as shown, and whether it is a gain: only a positive rate reads
  // in the success tone, not zero or an unknown rate.
  const getRewardRateAverage = () => {
    if (!providersDetails || !integrationData) return null;
    const average = providersDetails
      .reduce(
        (acc, val) => acc.plus(val.rewardRate ?? exactZero()),
        exactZero()
      )
      .dividedBy(providersDetails.length);

    return {
      text: formatRewardRatePercent(average, locale),
      isPositive: average.isGreaterThan(0),
    };
  };
  const rewardRateAverage = getRewardRateAverage();

  const inactiveValidator = toInactiveValidatorStatus(providersDetails);

  const total = toPositionTotalDisplay(item.total);
  // A row is narrow: from 1,000 the amount shows compactly, as its USD value
  // does; Position Details shows it in full.
  const getTotalFormatted = () => {
    if (total.amount) {
      return formatShortTokenAmountWithSymbol(total.amount, locale);
    }
    return total.amountUsd ? formatUsd(total.amountUsd, locale) : null;
  };

  return {
    hasHiddenBalance: item.balancesWithAmount.some(
      (balance) => balance.isEncrypted
    ),
    integrationData,
    providersDetails,
    rewardRateAverage,
    inactiveValidator,
    totalFormatted: getTotalFormatted(),
    // Several tokens show their USD total as the amount itself.
    totalAmountUsd: total.amount ? total.amountUsd : null,
  };
};
