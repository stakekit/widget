import { useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { presentationClockAtom } from "../../../../../shared/effect/presentation-clock";
import { formatAddress } from "../../../../../shared/lib/general";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import {
  Button,
  DetailList,
  DetailRow,
  Disclosure,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
} from "../../../../../ui/index";
import {
  CurrentRewardsSummaryKey,
  currentRewardsSummaryAtom,
} from "../../../../yield-summary/index";
import {
  YieldDetailsHeader,
  YieldRiskRatingActions,
} from "../../../../yield-summary/views";
import {
  getPositionHeaderBadges,
  getPositionOverviewModel,
  type PositionOverviewDetailValue,
} from "../../../model/position-overview";
import { usePositionDetails } from "../../../react/use-position-details";
import {
  PositionBreakdownRows,
  PositionMetricCards,
} from "./position-details-layout";

const renderDetailValue = (value: PositionOverviewDetailValue) =>
  typeof value === "string" ? (
    value
  ) : (
    <YieldRiskRatingActions risk={value.risk} />
  );

export const PositionDetailsInfo = () => {
  const positionDetails = usePositionDetails();
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const presentationTime = useAtomValue(presentationClockAtom);

  const rewardsYieldId = positionDetails.integrationData?.id ?? null;
  const rewardsSummaries = useAtomValue(
    currentRewardsSummaryAtom(
      new CurrentRewardsSummaryKey({
        yieldIds: rewardsYieldId ? [rewardsYieldId] : [],
      })
    )
  );

  if (positionDetails.isLoading) {
    return (
      <Stack gap={16} aria-busy>
        <Skeleton shape="rect" height="lg" />
        <Skeleton shape="rect" height="lg" />
        <Skeleton shape="rect" height="lg" />
      </Stack>
    );
  }

  const integrationData = positionDetails.integrationData;
  const positionBalancesByType = positionDetails.positionBalancesByType;
  if (!integrationData || !positionBalancesByType) {
    return (
      <Stack align="center">
        <Text tone="muted">{t("dashboard.position_details.empty")}</Text>
      </Stack>
    );
  }

  const model = getPositionOverviewModel({
    cancellingHandles: positionDetails.cancellingHandles,
    canUnstake: positionDetails.canUnstake,
    integrationData,
    locale,
    now: presentationTime?.now ?? null,
    pendingActions: positionDetails.pendingActions ?? [],
    personalizedRewardRate: positionDetails.personalizedRewardRate,
    positionBalancesByType,
    providersDetails: positionDetails.providersDetails ?? [],
    rewardsSummary:
      rewardsYieldId && rewardsSummaries._tag === "Ready"
        ? (rewardsSummaries.value?.[rewardsYieldId] ?? undefined)
        : undefined,
    t,
  });

  return (
    <ScrollArea label={t("dashboard.split_view.details")}>
      <Stack gap={24}>
        <YieldDetailsHeader
          headerBadges={getPositionHeaderBadges(integrationData, t)}
          providerName={model.providerName}
          yieldDto={integrationData}
        />

        <PositionMetricCards cards={model.metricCards} />

        {model.breakdownRows.length > 0 && (
          <Disclosure
            title={t("dashboard.position_details.breakdown")}
            defaultOpen
          >
            <Stack gap={12}>
              <PositionBreakdownRows rows={model.breakdownRows} />
              {positionDetails.hasHiddenBalances ? (
                <Stack gap={4}>
                  <Button
                    size="sm"
                    loading={positionDetails.revealing}
                    onClick={positionDetails.onRevealBalances}
                  >
                    {t("shared.confidential.reveal")}
                  </Button>
                  {positionDetails.revealFailed ? (
                    <Text tone="danger">
                      {t("shared.confidential.reveal_failed")}
                    </Text>
                  ) : null}
                </Stack>
              ) : null}
              {positionDetails.hasRevealedBalances ? (
                <Button size="sm" onClick={positionDetails.onHideBalances}>
                  {t("shared.confidential.hide")}
                </Button>
              ) : null}
            </Stack>
          </Disclosure>
        )}

        <Disclosure title={t("dashboard.position_details.details")} defaultOpen>
          <DetailList>
            {model.detailRows.map((row) => (
              <DetailRow
                key={row.id}
                label={row.label}
                value={renderDetailValue(row.value)}
              />
            ))}
            {model.addressRows.map((row) => (
              <DetailRow
                key={`${row.label}-${row.address}`}
                label={row.label}
                value={formatAddress(row.address)}
                copyable={{
                  value: row.address,
                  label: t("position_details.copy_address", {
                    label: row.label,
                  }),
                  copiedLabel: t("position_details.copied"),
                }}
              />
            ))}
          </DetailList>
        </Disclosure>
      </Stack>
    </ScrollArea>
  );
};
