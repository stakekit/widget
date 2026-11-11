import { useAtomValue } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import { Badge, Button, Stack, Text } from "../../../ui/index";
import {
  getCampaignBadge,
  getCampaignStripNote,
  getCampaignScheduleLine,
} from "../model/campaign-copy";
import { yieldCampaignAtom } from "../state/yield-campaign";
import { CampaignDetailsDialog } from "./campaign-details-dialog";

/**
 * The selected yield's campaign in one line under its rate: its badge, its
 * time left or to the start, and its details; a note follows while it is
 * not earning.
 */
export const CampaignStrip = ({
  yieldDto,
}: {
  readonly yieldDto: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const view = useAtomValue(yieldCampaignAtom(yieldDto.id));

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
        <CampaignDetailsDialog
          view={view}
          yieldDto={yieldDto}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          trigger={
            <Button size="sm" variant="link" testId="campaign-strip__details">
              {t("campaign.details_link")}
            </Button>
          }
        />
      </Stack>
      {note ? (
        <Text variant="caption" tone="muted">
          {note}
        </Text>
      ) : null}
    </Stack>
  );
};
