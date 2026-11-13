import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import type {
  RateComposition,
  RatePart,
} from "../../../../../domain/earn/reward-rate";
import { formatRewardRatePercent } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { DetailList, DetailRow, Stack, Text } from "../../../../../ui/index";
import { formatRatePartLabel } from "../../../../yield-presentation/index";

/**
 * The campaign's row, as its owner words it: such as "Paused" or a planned
 * rate before the campaign is part of the yield's rate, with a summary of
 * the campaign beside its label, and the total's label when the campaign
 * isn't in the total yet.
 */
export type RewardRateCampaignRow = {
  readonly value: string;
  readonly rateType: string | null;
  readonly info?: ComponentProps<typeof DetailRow>["info"];
  readonly totalLabel?: string;
};

type Row = {
  readonly id: "native" | "protocol-incentive" | "campaign";
  readonly label: string;
  readonly value: string;
  readonly info?: ComponentProps<typeof DetailRow>["info"];
};

/**
 * A rate's composition: the yield's own rate, its incentives and their total,
 * shown once there is more than the own rate to list.
 */
export const RewardRateBreakdown = ({
  composition,
  campaignUpTo = false,
  campaign,
  title,
  testId,
}: {
  composition: RateComposition | null | undefined;
  /**
   * The caller knows the campaign part is a ceiling, the most a wallet
   * earns, not the wallet's own: "Up to" it and the total, while the total
   * has it (not a planned part).
   */
  campaignUpTo?: boolean;
  /** The yield's campaign, whose row it words; see `RewardRateCampaignRow`. */
  campaign?: RewardRateCampaignRow | undefined;
  title?: string;
  testId?: string;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  if (!composition) return null;

  const upTo =
    campaignUpTo &&
    composition.campaign !== null &&
    composition.campaign.source !== "planned";
  const format = (part: RatePart, withUpTo: boolean) => {
    const value = formatRewardRatePercent(part.rate, locale);
    return withUpTo ? t("details.apy_composition.up_to", { value }) : value;
  };
  const campaignValue =
    campaign?.value ??
    (composition.campaign ? format(composition.campaign, upTo) : null);
  const candidates: ReadonlyArray<Row | null> = [
    {
      id: "native",
      label: formatRatePartLabel("native", composition.native.rateType, t),
      value: format(composition.native, false),
    },
    composition.protocolIncentive
      ? {
          id: "protocol-incentive",
          label: formatRatePartLabel(
            "protocol_incentive",
            composition.protocolIncentive.rateType,
            t
          ),
          value: format(composition.protocolIncentive, false),
        }
      : null,
    campaignValue === null
      ? null
      : {
          id: "campaign",
          label: formatRatePartLabel(
            "campaign",
            composition.campaign?.rateType ?? campaign?.rateType,
            t
          ),
          value: campaignValue,
          ...(campaign?.info ? { info: campaign.info } : {}),
        },
  ];
  const rows = candidates.filter((row): row is Row => row !== null);

  if (rows.length < 2) return null;

  return (
    <Stack gap={8} {...(testId ? { testId } : {})}>
      {title ? <Text tone="muted">{title}</Text> : null}

      <DetailList>
        {rows.map((row) => (
          <DetailRow
            key={row.id}
            label={row.label}
            value={row.value}
            {...(row.info ? { info: row.info } : {})}
            {...(testId ? { testId: `${testId}__${row.id}` } : {})}
          />
        ))}
        <DetailRow
          label={
            campaign?.totalLabel ??
            formatRatePartLabel("total", composition.total.rateType, t)
          }
          value={format(composition.total, upTo)}
          {...(testId ? { testId: `${testId}__total` } : {})}
        />
      </DetailList>
    </Stack>
  );
};
