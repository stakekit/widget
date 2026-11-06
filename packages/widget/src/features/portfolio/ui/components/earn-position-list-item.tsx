import type BigNumber from "bignumber.js";
import type { ComponentProps, ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { EarnYieldWithProvider } from "../../../../domain/earn/models";
import {
  formatPositionCallout,
  getPositionCallout,
  type InactiveValidatorStatus,
  type PositionCallout,
} from "../../../../domain/portfolio/position-callout";
import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import {
  formatTokenAmount,
  formatUsd,
  unavailableFigure,
} from "../../../../shared/lib/number-format";
import { useTokenLogo } from "../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import { Box, ListRow, Skeleton, TokenAvatar } from "../../../../ui/index";
import { useWidgetLinkProps } from "../../../navigation/index";
import type { YieldSummaryProvider } from "../../../yield-summary/index";
import type { PositionItem } from "../../state/read-models/positions";

export type EarnPositionListItemDetails = {
  readonly hasHiddenBalance: boolean;
  readonly integrationData: EarnYieldWithProvider | null;
  readonly providersDetails: ReadonlyArray<YieldSummaryProvider> | null;
  readonly inactiveValidator: InactiveValidatorStatus | null;
  /** The average rate as shown, and whether it is a gain. */
  readonly rewardRateAverage: {
    readonly text: string;
    readonly isPositive: boolean;
  } | null;
  /** The total: its amount and token, or its USD value across tokens. */
  readonly totalFormatted: string | null;
  /** USD value beside a single-token total, when priced. */
  readonly totalAmountUsd: BigNumber | null;
};

type RowStatus = NonNullable<ComponentProps<typeof ListRow>["status"]>;

/**
 * How each status a row calls out reads. Every status that asks something of
 * the user, rewards to claim among them, shares the warning tone the Manage
 * tab's count wears; work already under way is info.
 */
const calloutLook = {
  readyToWithdraw: { tone: "warning", icon: "ArrowDownIcon" },
  readyToUnlock: { tone: "warning", icon: "LockIcon" },
  lockedBalance: { tone: "warning", icon: "LockIcon" },
  actionRequired: { tone: "warning", icon: "WarningIcon" },
  validatorsJailed: { tone: "warning", icon: "WarningIcon" },
  validatorsInactive: { tone: "warning", icon: "WarningIcon" },
  rewardsToClaim: { tone: "warning", icon: "GiftIcon" },
  inProgress: { tone: "info", icon: "HistoryIcon" },
} as const satisfies Record<PositionCallout, Omit<RowStatus, "text">>;

/** The one status a row shows, the most pressing first. */
const usePositionRowStatus = (
  item: PositionItem,
  inactiveValidator: InactiveValidatorStatus | null
): RowStatus | null => {
  const { t } = useTranslation();
  const callout = getPositionCallout({ attention: item, inactiveValidator });

  if (callout === null) return null;
  return { text: formatPositionCallout(callout, t), ...calloutLook[callout] };
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
    return showsMissingAmountPlaceholder ? { value: unavailableFigure } : {};
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
  const status = usePositionRowStatus(item, details.inactiveValidator);
  const values = useValueProps({ details, showsMissingAmountPlaceholder });
  const provider = details.providersDetails?.[0];
  const rewardRate = showsRewardRate ? details.rewardRateAverage : null;
  // Success is for gains only: zero or an unknown rate reads muted.
  const rewardRateTone = rewardRate?.isPositive ? "success" : "muted";

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
            figure: {
              text: rewardRate.text,
              tone: rewardRateTone,
              from: "sm",
            } as const,
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
  /** Whether an unpriced or unloaded amount renders a "—" placeholder. */
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
