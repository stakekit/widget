import { useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import { Button, Notice } from "../../../ui/index";
import { getCampaignOfferText } from "../model/campaign-copy";
import { yieldCampaignAtom } from "../state/yield-campaign";

/**
 * Offers `yieldDto`'s earning campaign beside a yield without one: what it
 * pays and a switch to it.
 */
export const CampaignOfferBanner = ({
  yieldDto,
  onSwitch,
}: {
  readonly yieldDto: EarnYieldWithProvider;
  readonly onSwitch: () => void;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const view = useAtomValue(yieldCampaignAtom(yieldDto.id));

  if (!view) return null;

  return (
    <Notice tone="accent" testId="campaign-offer">
      {getCampaignOfferText(view, yieldDto, t, locale)}{" "}
      <Button size="sm" variant="link" onClick={onSwitch}>
        {t("campaign.offer.switch")}
      </Button>
    </Notice>
  );
};
