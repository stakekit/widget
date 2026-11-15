import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";
import {
  CampaignPayoutsKey,
  campaignPayoutsResourceAtom,
  retryCampaignPayoutsAtom,
} from "../../../resources/campaign-rewards/campaign-rewards";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import {
  Button,
  DetailList,
  DetailRow,
  Disclosure,
  Metric,
  MetricGroup,
  Notice,
  Skeleton,
  Stack,
  Text,
} from "../../../ui/index";
import {
  getCampaignPayoutRow,
  getCampaignRewardsSectionModel,
} from "../model/campaign-rewards-copy";
import type { ReadyCampaignRewardsView } from "../model/campaign-rewards-view";
import {
  PositionCampaignRewardsKey,
  positionCampaignRewardsAtom,
  retryPositionCampaignRewardsAtom,
} from "../state/position-rewards";

const RECENT_PAYOUTS = 5;

/** A neutral notice that what it describes can load again. */
const RetryNotice = ({
  text,
  retryLabel,
  onRetry,
  testId,
}: {
  readonly text: string;
  readonly retryLabel: string;
  readonly onRetry: () => void;
  readonly testId?: string;
}) => (
  <Notice
    tone="neutral"
    {...(testId ? { testId } : {})}
    action={
      <Button size="sm" variant="link" onClick={onRetry}>
        {retryLabel}
      </Button>
    }
  >
    {text}
  </Notice>
);

const RewardsSkeleton = () => (
  <Stack gap={12} testId="campaign-rewards__loading">
    <Skeleton shape="rect" height="lg" />
    <Skeleton shape="line" width="half" />
    <Skeleton shape="rect" height="md" />
  </Stack>
);

/**
 * A wallet's payouts in a campaign: the five most recent, then page after
 * page of them once expanded. Nothing before the first payout.
 */
const CampaignPayouts = ({
  scope,
  view,
  yieldDto,
}: {
  readonly scope: WalletScopeKey;
  readonly view: ReadyCampaignRewardsView;
  readonly yieldDto: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  // 0 shows the recent payouts; from 1, that many pages of every payout.
  const [pages, setPages] = useState(0);
  const key = new CampaignPayoutsKey({
    campaignId: view.rewards.campaignId,
    pages: Math.max(1, pages),
    scope,
  });
  const payouts = useAtomValue(campaignPayoutsResourceAtom(key));
  const retry = useAtomSet(retryCampaignPayoutsAtom(key));
  const expanded = pages > 0;
  const total = payouts.total ?? payouts.items.length;
  const failedNotice = (
    <RetryNotice
      text={t("campaign.rewards.payouts.unavailable")}
      retryLabel={t("campaign.rewards.payouts.retry")}
      onRetry={() => retry(undefined)}
    />
  );

  if (payouts.items.length === 0) {
    if (payouts.loading) return <Skeleton shape="rect" height="md" />;
    if (payouts.failed) return failedNotice;
    return null;
  }

  const toggleLabel = expanded
    ? t("campaign.rewards.payouts.show_less")
    : t("campaign.rewards.payouts.show_all", { count: total });

  return (
    <Stack gap={8} testId="campaign-rewards__payouts">
      <Stack direction="row" align="center" justify="between" gap={8}>
        <Text weight="medium">
          {expanded
            ? t("campaign.rewards.payouts.all", { count: total })
            : t("campaign.rewards.payouts.recent")}
        </Text>
        {total > RECENT_PAYOUTS ? (
          <Button
            size="sm"
            variant="link"
            onClick={() => setPages(expanded ? 0 : 1)}
          >
            {toggleLabel}
          </Button>
        ) : null}
      </Stack>
      <DetailList>
        {(expanded
          ? payouts.items
          : payouts.items.slice(0, RECENT_PAYOUTS)
        ).map((payout, index) => {
          const row = getCampaignPayoutRow(
            payout,
            view,
            yieldDto.token,
            t,
            locale
          );
          return (
            <DetailRow
              key={`${payout.txHash ?? "pending"}-${index}`}
              label={row.label}
              value={row.value}
              tone={payout.status === "paid" ? "success" : "default"}
              {...(row.caption ? { caption: row.caption } : {})}
            />
          );
        })}
      </DetailList>
      {expanded && payouts.failed ? failedNotice : null}
      {expanded && payouts.hasMore && !payouts.failed ? (
        <Stack direction="row">
          <Button
            size="sm"
            variant="secondary"
            loading={payouts.loading}
            onClick={() => setPages(pages + 1)}
          >
            {t("campaign.rewards.payouts.show_more")}
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
};

const ReadyRewards = ({
  scope,
  view,
  yieldDto,
  onRetry,
}: {
  readonly scope: WalletScopeKey;
  readonly view: ReadyCampaignRewardsView;
  readonly yieldDto: EarnYieldWithProvider;
  readonly onRetry: () => void;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const model = getCampaignRewardsSectionModel(view, yieldDto.token, t, locale);

  return (
    <Stack gap={12}>
      {model.notices.map((notice) => (
        <Notice
          key={notice.id}
          tone={notice.tone}
          testId={`campaign-rewards__notice-${notice.id}`}
          {...(notice.title ? { title: notice.title } : {})}
        >
          {notice.text}
        </Notice>
      ))}

      {model.metrics.length > 0 ? (
        <MetricGroup columns={3} framed>
          {model.metrics.map((metric) => (
            <Metric
              key={metric.id}
              label={metric.label}
              value={metric.value}
              testId={`campaign-rewards__${metric.id}`}
              {...(metric.caption ? { caption: metric.caption } : {})}
            />
          ))}
        </MetricGroup>
      ) : null}

      {view.stale ? (
        <RetryNotice
          text={t("campaign.rewards.notice.unavailable")}
          retryLabel={t("campaign.rewards.notice.retry")}
          onRetry={onRetry}
        />
      ) : null}

      {model.compoundNote ? (
        <Text variant="caption" tone="muted">
          {model.compoundNote}
        </Text>
      ) : null}

      <CampaignPayouts
        // Another campaign starts its payouts list from its recent ones.
        key={view.rewards.campaignId}
        scope={scope}
        view={view}
        yieldDto={yieldDto}
      />
    </Stack>
  );
};

/**
 * A position's rewards in its yield's Campaign: what the wallet earned over
 * the whole campaign, why it does or doesn't earn, and its payouts. Nothing
 * when the wallet has no rewards there; the position stays usable whatever
 * the rewards' state.
 */
export const CampaignRewardsSection = ({
  scope,
  yieldDto,
}: {
  readonly scope: WalletScopeKey;
  readonly yieldDto: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();
  const view = useAtomValue(
    positionCampaignRewardsAtom(
      new PositionCampaignRewardsKey({ scope, yieldId: yieldDto.id })
    )
  );
  const retry = useAtomSet(retryPositionCampaignRewardsAtom(scope));

  if (!view) return null;

  return (
    <Disclosure title={t("campaign.rewards.title")} defaultOpen>
      <Stack gap={12} testId="campaign-rewards">
        {view._tag === "Loading" ? <RewardsSkeleton /> : null}
        {view._tag === "Unavailable" ? (
          <RetryNotice
            testId="campaign-rewards__unavailable"
            text={t("campaign.rewards.notice.unavailable")}
            retryLabel={t("campaign.rewards.notice.retry")}
            onRetry={() => retry(undefined)}
          />
        ) : null}
        {view._tag === "Ready" ? (
          <ReadyRewards
            scope={scope}
            view={view}
            yieldDto={yieldDto}
            onRetry={() => retry(undefined)}
          />
        ) : null}
      </Stack>
    </Disclosure>
  );
};
