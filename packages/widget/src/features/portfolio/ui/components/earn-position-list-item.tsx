import type BigNumber from "bignumber.js";
import type { ComponentProps, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../domain/earn/models";
import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../../shared/lib/number-format";
import { useTokenLogo } from "../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import { Box, ListRow, Skeleton, TokenAvatar } from "../../../../ui/index";
import { useWidgetLinkProps } from "../../../navigation/index";
import type { YieldSummaryProvider } from "../../../yield-summary/index";
import type { InactiveValidatorStatus } from "../../state/read-models/position-list-item";
import type { PositionItem } from "../../state/read-models/positions";

export type EarnPositionListItemDetails = {
  readonly hasHiddenBalance: boolean;
  readonly integrationData: EarnYieldWithProvider | null;
  readonly providersDetails: ReadonlyArray<YieldSummaryProvider> | null;
  readonly inactiveValidator: InactiveValidatorStatus | null;
  readonly rewardRateAverage: string | null;
  /** The total: its amount and token, or its USD value across tokens. */
  readonly totalFormatted: string | null;
  /** USD value beside a single-token total, when priced. */
  readonly totalAmountUsd: BigNumber | null;
};

type RowStatus = NonNullable<ComponentProps<typeof ListRow>["status"]>;

/** How each kind of status a row calls out reads. */
const statusLook = {
  attention: { tone: "danger", icon: "WarningIcon" },
  claimable: { tone: "success", icon: "GiftIcon" },
  pending: { tone: "warning", icon: "HistoryIcon" },
} as const satisfies Record<string, Omit<RowStatus, "text">>;

/** The one status a row shows, the most pressing first. */
const useStatus = (
  item: PositionItem,
  inactiveValidator: InactiveValidatorStatus | null
): RowStatus | null => {
  const { t } = useTranslation();

  if (item.actionRequired) {
    return { text: t("positions.action_required"), ...statusLook.attention };
  }
  if (inactiveValidator === "jailed") {
    return { text: t("details.validators_jailed"), ...statusLook.attention };
  }
  if (inactiveValidator) {
    return { text: t("details.validators_inactive"), ...statusLook.attention };
  }
  if (item.hasPendingClaimRewards) {
    return { text: t("positions.claim_rewards"), ...statusLook.claimable };
  }
  if (item.hasPendingRequest) {
    return { text: t("positions.in_progress"), ...statusLook.pending };
  }
  return null;
};

/** The row's figures: the total and its USD estimate, or a placeholder. */
const useValueProps = ({
  details,
  showsMissingAmountPlaceholder,
}: {
  readonly details: EarnPositionListItemDetails;
  readonly showsMissingAmountPlaceholder: boolean;
}): { readonly value?: string; readonly subvalue?: string } => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  if (details.hasHiddenBalance) {
    return { value: t("shared.confidential.hidden") };
  }
  if (!details.totalFormatted) {
    return showsMissingAmountPlaceholder ? { value: "-" } : {};
  }
  return details.totalAmountUsd
    ? {
        value: details.totalFormatted,
        subvalue: `≈ ${formatUsd(details.totalAmountUsd, locale)}`,
      }
    : { value: details.totalFormatted };
};

const EarnPositionRow = ({
  item,
  details,
  integrationData,
  opensDetailsWithViewTransition,
  showsMissingAmountPlaceholder,
  showsRewardRate,
}: {
  readonly item: PositionItem;
  readonly details: EarnPositionListItemDetails;
  readonly integrationData: EarnYieldWithProvider;
  readonly opensDetailsWithViewTransition: boolean;
  readonly showsMissingAmountPlaceholder: boolean;
  readonly showsRewardRate: boolean;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const link = useWidgetLinkProps(
    widgetRoutes.positionDetails.build({
      balanceId: item.balanceId,
      integrationId: item.integrationId,
    }),
    { viewTransition: opensDetailsWithViewTransition }
  );
  // The primary Value Token labels the total.
  const logo = useTokenLogo(item.total[0]?.token ?? integrationData.token, {
    metadata: {
      logoURI: integrationData.metadata.logoURI,
      name: integrationData.metadata.name,
      provider: integrationData.provider,
    },
  });
  const status = useStatus(item, details.inactiveValidator);
  const values = useValueProps({ details, showsMissingAmountPlaceholder });
  const provider = details.providersDetails?.[0];
  const rewardRate = showsRewardRate ? details.rewardRateAverage : null;

  return (
    <ListRow
      link={link}
      leading={<TokenAvatar {...logo} />}
      title={integrationData.metadata.name}
      {...(provider
        ? {
            subtitle: t("positions.via", {
              providerName: provider.name ?? provider.address,
              count: Math.max((details.providersDetails?.length ?? 1) - 1, 1),
            }),
          }
        : {})}
      {...(status ? { status } : {})}
      {...(rewardRate
        ? {
            // A narrow row keeps its room for the title and the value.
            figure: { text: rewardRate, tone: "success", from: "sm" } as const,
          }
        : {})}
      {...values}
      {...(item.pointsRewardTokenBalances.length > 0
        ? {
            details: item.pointsRewardTokenBalances.map((balance) => ({
              label: balance.token.symbol,
              value: formatTokenAmount(balance.amount, locale, "down"),
            })),
          }
        : {})}
    />
  );
};

export const EarnPositionListItem = ({
  item,
  details,
  opensDetailsWithViewTransition,
  showsMissingAmountPlaceholder,
  showsRewardRate,
}: {
  readonly item: PositionItem;
  readonly details: EarnPositionListItemDetails;
  /** Whether opening Position Details runs a view transition. */
  readonly opensDetailsWithViewTransition: boolean;
  /** Whether an unpriced or unloaded amount renders a "-" placeholder. */
  readonly showsMissingAmountPlaceholder: boolean;
  /** Whether the row shows the average reward rate next to the amount. */
  readonly showsRewardRate: boolean;
}): ReactElement => (
  <Box paddingBlock={4}>
    {details.integrationData ? (
      <EarnPositionRow
        item={item}
        details={details}
        integrationData={details.integrationData}
        opensDetailsWithViewTransition={opensDetailsWithViewTransition}
        showsMissingAmountPlaceholder={showsMissingAmountPlaceholder}
        showsRewardRate={showsRewardRate}
      />
    ) : (
      <Skeleton shape="rect" height="lg" />
    )}
  </Box>
);
