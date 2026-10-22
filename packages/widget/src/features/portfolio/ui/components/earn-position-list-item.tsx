import type BigNumber from "bignumber.js";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { isConfidentialYield } from "../../../../domain/earn/confidential";
import type { EarnYieldWithProvider } from "../../../../domain/earn/models";
import type { PositionDetailsLabelType } from "../../../../domain/portfolio/positions";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../../shared/lib/number-format";
import { TokenIcon } from "../../../../shared/ui/components/token-icon";
import { ToolTip } from "../../../../shared/ui/components/tooltip";
import { Box } from "../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../shared/ui/primitives/content-loader";
import { SKLink } from "../../../../shared/ui/primitives/link";
import { ListItem } from "../../../../shared/ui/primitives/list/list-item";
import { Spinner } from "../../../../shared/ui/primitives/spinner";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { useWidgetPresentation } from "../../../../shared/ui/widget-presentation";
import type { YieldSummaryProvider } from "../../../yield-summary/index";
import type { PositionItem } from "../../state/read-models/positions";
import {
  listItem,
  noWrap,
  positionBadge,
  positionInfoColumn,
  positionName,
  rewardRateText,
  viaText,
} from "./position-list-item.css";

export type EarnPositionListItemDetails = {
  readonly hasHiddenBalance: boolean;
  readonly integrationData: EarnYieldWithProvider | null;
  readonly providersDetails: ReadonlyArray<YieldSummaryProvider> | null;
  readonly inactiveValidator: Exclude<
    NonNullable<YieldSummaryProvider["status"]>,
    "active"
  > | null;
  readonly rewardRateAverage: string | null;
  readonly totalAmountFormatted: string | null;
  /** Positive USD value of the position, when priced. */
  readonly totalAmountUsd: BigNumber | null;
};

type Presentation = "classic" | "dashboard";

const EarnPositionAmount = ({
  item,
  details,
  presentation,
}: {
  readonly item: PositionItem;
  readonly details: EarnPositionListItemDetails;
  readonly presentation: Presentation;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  // Confidential amounts stay hidden here, even after a reveal in details.
  const hidden =
    details.hasHiddenBalance ||
    (details.integrationData !== null &&
      isConfidentialYield(details.integrationData));

  if (details.totalAmountFormatted && item.token) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="flex-end"
        textAlign="end"
        gap="1"
      >
        <Text className={noWrap}>
          {hidden
            ? t("shared.confidential.hidden")
            : `${details.totalAmountFormatted} ${item.token.symbol}`}
        </Text>

        {details.totalAmountUsd && !hidden ? (
          <Text
            className={noWrap}
            variant={{ type: "muted", weight: "normal" }}
          >
            ≈ {formatUsd(details.totalAmountUsd, locale)}
          </Text>
        ) : null}
      </Box>
    );
  }

  if (presentation === "dashboard") return <Text>-</Text>;

  return null;
};

export const EarnPositionListItem = ({
  item,
  details,
  presentation,
}: {
  readonly item: PositionItem;
  readonly details: EarnPositionListItemDetails;
  readonly presentation: Presentation;
}): ReactElement => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  const {
    integrationData,
    providersDetails,
    inactiveValidator,
    rewardRateAverage,
  } = details;
  const isDashboard = presentation === "dashboard";
  const actionBadge = (() => {
    if (item.actionRequired) {
      return {
        label: t("positions.action_required"),
        type: "actionRequired",
      } as const;
    }
    if (inactiveValidator === "jailed") {
      return {
        label: t("details.validators_jailed"),
        type: "actionRequired",
      } as const;
    }
    if (inactiveValidator) {
      return {
        label: t("details.validators_inactive"),
        type: "actionRequired",
      } as const;
    }
    if (item.hasPendingClaimRewards) {
      return { label: t("positions.claim_rewards"), type: "claim" } as const;
    }
    if (item.hasPendingRequest) {
      return { label: t("positions.in_progress"), type: "pending" } as const;
    }
    return null;
  })();

  return (
    <SKLink
      relative="path"
      to={`../positions/${item.integrationId}/${item.balanceId}`}
      viewTransition={isDashboard}
    >
      <Box py="1">
        {integrationData ? (
          <ListItem className={listItem}>
            <Box
              display="flex"
              width="full"
              alignItems="center"
              justifyContent="space-between"
              gap="2"
            >
              {/* Yield */}
              <Box
                display="flex"
                alignItems="center"
                gap="2"
                flex={1}
                minWidth="0"
              >
                {item.token ? (
                  <TokenIcon
                    metadata={{
                      logoURI: integrationData.metadata.logoURI,
                      name: integrationData.metadata.name,
                      provider: integrationData.provider,
                    }}
                    token={item.token}
                  />
                ) : (
                  <Box display="flex" marginRight="2">
                    <Spinner />
                  </Box>
                )}

                <Box className={positionInfoColumn}>
                  <Box display="flex" alignItems="center" gap="1">
                    <Text className={positionName}>
                      {integrationData.metadata.name}
                    </Text>

                    {item.yieldLabelDto ? (
                      <ToolTip
                        textAlign="left"
                        maxWidth={300}
                        label={t(
                          `position_details.labels.${item.yieldLabelDto.type as PositionDetailsLabelType}.details`,
                          item.yieldLabelDto.params as
                            | Record<string, string>
                            | undefined
                        )}
                      >
                        <Box
                          className={positionBadge({ type: "actionRequired" })}
                        >
                          <Text variant={{ type: "white" }} className={noWrap}>
                            {t(
                              `position_details.labels.${item.yieldLabelDto.type as PositionDetailsLabelType}.label`
                            )}
                          </Text>
                        </Box>
                      </ToolTip>
                    ) : null}

                    {actionBadge ? (
                      <Box
                        className={positionBadge({ type: actionBadge.type })}
                      >
                        <Text variant={{ type: "white" }} className={noWrap}>
                          {actionBadge.label}
                        </Text>
                      </Box>
                    ) : null}
                  </Box>

                  {providersDetails?.[0] ? (
                    <Text
                      className={viaText}
                      variant={{ type: "muted", weight: "normal" }}
                    >
                      {t("positions.via", {
                        providerName:
                          providersDetails[0].name ??
                          providersDetails[0].address,
                        count: Math.max(providersDetails.length - 1, 1),
                      })}
                    </Text>
                  ) : null}
                </Box>
              </Box>

              {/* Reward rate + staked */}
              <Box display="flex" alignItems="center" gap="4" flexShrink={0}>
                {isDashboard && rewardRateAverage ? (
                  <Text className={rewardRateText}>{rewardRateAverage}</Text>
                ) : null}

                <EarnPositionAmount
                  item={item}
                  details={details}
                  presentation={presentation}
                />
              </Box>
            </Box>

            {item.pointsRewardTokenBalances.length > 0 && (
              <Box display="flex" alignSelf="flex-end" gap="1">
                {item.pointsRewardTokenBalances.map((val, i) => (
                  <Box
                    key={i}
                    alignSelf="flex-end"
                    background="background"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    borderRadius="lg"
                    px="2"
                    py="1"
                    gap="1"
                  >
                    <TokenIcon token={val.token} hideNetwork tokenLogoHw="5" />

                    <Text
                      overflowWrap="anywhere"
                      variant={{ type: "muted", weight: "normal" }}
                    >
                      {formatTokenAmount(val.amount, locale, "down")}
                    </Text>
                  </Box>
                ))}
              </Box>
            )}
          </ListItem>
        ) : (
          <ContentLoaderSquare heightPx={60} />
        )}
      </Box>
    </SKLink>
  );
};
