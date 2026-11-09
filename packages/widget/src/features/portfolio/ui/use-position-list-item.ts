import { useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import { exactZero } from "../../../domain/finance/exact";
import { toInactiveValidatorStatus } from "../../../domain/portfolio/position-callout";
import {
  formatRewardRatePercent,
  formatTokenAmountWithSymbol,
  formatUsd,
  withFigureUnit,
} from "../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import { formatRewardRateLabel } from "../../yield-presentation/index";
import { YieldSummaryKey, yieldSummaryAtom } from "../../yield-summary/index";
import { type PositionItem, toPositionTotalDisplay } from "../model/positions";
import { positionYieldAtom } from "../state/read-models/position-list-item";

export const usePositionListItem = (item: PositionItem) => {
  const { t } = useTranslation();
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

  // The rate as shown with its type ("4.52% APY"), and whether it is a gain:
  // only a positive rate reads in the success tone, not zero or an unknown
  // rate, the same rule as the yield picker's.
  const getRewardRateAverage = () => {
    if (!providersDetails || !integrationData) return null;
    const average = providersDetails
      .reduce(
        (acc, val) => acc.plus(val.rewardRate ?? exactZero()),
        exactZero()
      )
      .dividedBy(providersDetails.length);

    return {
      text: withFigureUnit(
        formatRewardRatePercent(average, locale),
        formatRewardRateLabel(integrationData, t)
      ),
      isPositive: average.isGreaterThan(0),
    };
  };
  const rewardRateAverage = getRewardRateAverage();

  const inactiveValidator = toInactiveValidatorStatus(providersDetails);

  const total = toPositionTotalDisplay(item.total);
  // A row is narrow: from 1,000,000 the amount shows compactly, as its USD
  // value does; Position Details shows it in full.
  const getTotalFormatted = () => {
    if (total.amount) {
      return formatTokenAmountWithSymbol(total.amount, locale);
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
