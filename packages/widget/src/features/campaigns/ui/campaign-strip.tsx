import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import { Badge, Button, Stack, Text } from "../../../ui/index";
import {
  getCampaignBadge,
  getCampaignStripNote,
  getCampaignScheduleLine,
} from "../model/campaign-copy";
import { requestCampaignDetailsAtom } from "../state/campaign-details-request";
import { yieldCampaignAtom } from "../state/yield-campaign";

/**
 * The selected yield's campaign in one line under its rate: its badge, its
 * end or start date, and a link that brings up its Campaign section; a note
 * follows while it is not earning.
 */
export const CampaignStrip = ({
  yieldDto,
}: {
  readonly yieldDto: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const view = useAtomValue(yieldCampaignAtom(yieldDto.id));
  const requestDetails = useAtomSet(requestCampaignDetailsAtom);

  if (!view) return null;

  const badge = getCampaignBadge(view.lifecycle, t);
  const note = getCampaignStripNote(view, t, locale);

  return (
    <Stack gap={4} testId="campaign-strip">
      <Stack direction="row" align="center" justify="between" gap={8}>
        <Stack direction="row" align="center" gap={8} wrap>
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <Text
            variant="caption"
            tone={view.lifecycle === "ending_soon" ? "warning" : "muted"}
          >
            {getCampaignScheduleLine(view, t, locale)}
          </Text>
        </Stack>
        <Button
          size="sm"
          variant="link"
          testId="campaign-strip__details"
          onClick={() => requestDetails(yieldDto.id)}
        >
          {t("campaign.details_link")}
        </Button>
      </Stack>
      {note ? (
        <Text variant="caption" tone="muted">
          {note}
        </Text>
      ) : null}
    </Stack>
  );
};
