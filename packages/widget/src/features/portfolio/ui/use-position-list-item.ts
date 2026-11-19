import { useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import { hasEncryptedBalance } from "../../../domain/earn/confidential-vault";
import { toInactiveValidatorStatus } from "../../../domain/portfolio/position-callout";
import {
  formatRewardRatePercent,
  formatTokenAmountWithSymbol,
  formatUsd,
  withFigureUnit,
} from "../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import {
  getCampaignRowModel,
  positionCampaignRowAtom,
  yieldCampaignAtom,
} from "../../campaigns/index";
import { formatRateTypeLabel } from "../../yield-presentation/index";
import { YieldSummaryKey, yieldSummaryAtom } from "../../yield-summary/index";
import {
  getPositionItemRate,
  type PositionItem,
  toPositionTotalDisplay,
} from "../model/positions";
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

  const shownCampaign =
    useAtomValue(yieldCampaignAtom(item.integrationId))?.campaign ?? null;

  // The rate as shown with its type ("4.52% APY"), and whether it is a gain:
  // only a positive rate reads in the success tone, not zero or an unknown
  // rate, the same rule as the yield picker's. A row with nothing earning
  // shows no rate. It is the rate the position's page leads with.
  const getRewardRate = () => {
    if (!integrationData || !item.hasEarningBalances) return null;
    const { rate, rateType } = getPositionItemRate(
      item,
      integrationData.rewardRate,
      () => shownCampaign
    );

    return {
      text: withFigureUnit(
        formatRewardRatePercent(rate, locale),
        formatRateTypeLabel(rateType ?? "", t)
      ),
      isPositive: rate.isGreaterThan(0),
    };
  };

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

  // A yield's rewards belong to the whole position, so a position split by
  // validator badges every row but shows the earned line on none, rather
  // than repeating it on each.
  const campaignRow = useAtomValue(positionCampaignRowAtom(item.integrationId));
  const campaignModel =
    campaignRow && integrationData
      ? getCampaignRowModel(campaignRow, integrationData.token, t, locale)
      : null;
  const campaign =
    campaignModel && item.type === "validators"
      ? { ...campaignModel, line: null }
      : campaignModel;

  return {
    campaign,
    hasHiddenBalance: hasEncryptedBalance(item.balancesWithAmount),
    integrationData,
    providersDetails,
    rewardRate: getRewardRate(),
    inactiveValidator,
    totalFormatted: getTotalFormatted(),
    // Several tokens show their USD total as the amount itself.
    totalAmountUsd: total.amount ? total.amountUsd : null,
  };
};
