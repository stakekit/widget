import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { Position as BorrowPosition } from "../../../../../../domain/borrow/position";
import type { PositionDetailsLabelType } from "../../../../../../domain/types/positions";
import {
  formatBorrowProviderName,
  formatPercent,
  formatUsd,
} from "../../../../../../shared/lib/formatters";
import { formatNumber } from "../../../../../../shared/lib/number-format";
import { TokenIcon } from "../../../../../../shared/ui/components/token-icon";
import { ToolTip } from "../../../../../../shared/ui/components/tooltip";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../../shared/ui/primitives/content-loader";
import { SKLink } from "../../../../../../shared/ui/primitives/link";
import { ListItem } from "../../../../../../shared/ui/primitives/list/list-item";
import { Spinner } from "../../../../../../shared/ui/primitives/spinner";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import { borrowTokenToTokenDto } from "../../../../../borrow/state";
import type { UnifiedPositionItem } from "../../../../resources/positions";
import {
  listItem,
  noWrap,
  positionInfoColumn,
  positionName,
  rewardRateText,
} from "../../../classic/positions-page/components/styles.css";
import { usePositionListItem } from "../hooks/use-position-list-item";
import { listItemContainer, viaText } from "../styles.css";

const BorrowPositionsListItem = ({
  position,
}: {
  readonly position: BorrowPosition;
}) => {
  const { t } = useTranslation();
  const meta = position.getMeta();
  const currentLtv = position.getCurrentLtv();
  const headerToken = borrowTokenToTokenDto({
    network: position.market.network,
    token: position.debtBalance
      ? position.market.loanToken
      : (position.market.collateralTokens[0]?.token ??
        position.market.loanToken),
  });
  const balanceText = position.debtBalance
    ? `${formatNumber(position.debtBalance.balance, 6)} ${
        position.debtBalance.tokenSymbol
      }`
    : formatUsd(position.getTotalSuppliedUsd().toString());
  const subValue = position.debtBalance
    ? `${formatPercent(currentLtv)} ${t(
        "dashboard.borrow.position_details.ltv"
      )} · ${formatUsd(
        position.debtBalance.balanceUsd.toString()
      )} ${t("dashboard.borrow.position_details.debt").toLowerCase()}`
    : t("dashboard.borrow.position_details.supplied");

  return (
    <SKLink relative="path" to={`../positions/borrow/${position.id}`}>
      <Box py="1">
        <ListItem className={listItem}>
          <Box
            display="flex"
            width="full"
            alignItems="center"
            justifyContent="space-between"
            gap="2"
          >
            <Box
              display="flex"
              alignItems="center"
              gap="2"
              flex={1}
              minWidth="0"
            >
              <TokenIcon token={headerToken} />

              <Box className={positionInfoColumn}>
                <Box display="flex" alignItems="center" gap="1">
                  <Text className={positionName}>{meta.name}</Text>
                  <Box className={listItemContainer({ type: "pending" })}>
                    <Text variant={{ type: "white" }} className={noWrap}>
                      {t("dashboard.details.tabs.borrow")}
                    </Text>
                  </Box>
                </Box>

                <Text
                  className={viaText}
                  variant={{ type: "muted", weight: "normal" }}
                >
                  {t("positions.via", {
                    providerName: formatBorrowProviderName(
                      position.integration.name
                    ),
                    count: 1,
                  })}
                </Text>
              </Box>
            </Box>

            <Box display="flex" alignItems="center" gap="4" flexShrink={0}>
              <Text className={rewardRateText}>
                {formatPercent(position.getBorrowApy())}
              </Text>

              <Box
                display="flex"
                flexDirection="column"
                alignItems="flex-end"
                textAlign="end"
                gap="1"
              >
                <Text className={noWrap}>{balanceText}</Text>
                <Text
                  className={noWrap}
                  variant={{ type: "muted", weight: "normal" }}
                >
                  {subValue}
                </Text>
              </Box>
            </Box>
          </Box>
        </ListItem>
      </Box>
    </SKLink>
  );
};

const EarnPositionsListItem = ({
  item,
}: {
  item: Extract<UnifiedPositionItem, { kind: "earn" }>["position"];
}) => {
  const { t } = useTranslation();

  const {
    integrationData,
    providersDetails,
    inactiveValidator,
    rewardRateAverage,
    totalAmountFormatted,
    totalAmountPriceFormatted,
  } = usePositionListItem(item);
  const actionBadgeType =
    item.actionRequired || inactiveValidator ? "actionRequired" : "claim";
  const getActionBadgeLabel = () => {
    if (item.actionRequired) return t("positions.action_required");
    if (inactiveValidator === "jailed") {
      return t("details.validators_jailed");
    }
    if (inactiveValidator) return t("details.validators_inactive");
    return t("positions.claim_rewards");
  };
  const actionBadgeLabel = getActionBadgeLabel();

  return (
    <SKLink
      relative="path"
      to={`../positions/${item.integrationId}/${item.balanceId}`}
      viewTransition
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
                          className={listItemContainer({
                            type: "actionRequired",
                          })}
                        >
                          <Text variant={{ type: "white" }} className={noWrap}>
                            {t(
                              `position_details.labels.${item.yieldLabelDto.type as PositionDetailsLabelType}.label`
                            )}
                          </Text>
                        </Box>
                      </ToolTip>
                    ) : null}

                    {(item.actionRequired ||
                      item.hasPendingClaimRewards ||
                      !!inactiveValidator) && (
                      <Box
                        className={listItemContainer({
                          type: actionBadgeType,
                        })}
                      >
                        <Text variant={{ type: "white" }} className={noWrap}>
                          {actionBadgeLabel}
                        </Text>
                      </Box>
                    )}
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
                {rewardRateAverage ? (
                  <Text className={rewardRateText}>{rewardRateAverage}</Text>
                ) : null}

                {totalAmountFormatted && item.token ? (
                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="flex-end"
                    textAlign="end"
                    gap="1"
                  >
                    <Text className={noWrap}>
                      {totalAmountFormatted} {item.token.symbol}
                    </Text>

                    {totalAmountPriceFormatted ? (
                      <Text
                        className={noWrap}
                        variant={{ type: "muted", weight: "normal" }}
                      >
                        ≈ ${totalAmountPriceFormatted}
                      </Text>
                    ) : null}
                  </Box>
                ) : (
                  <Text>-</Text>
                )}
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
                      {val.amount}
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

export const PositionsListItem = memo(
  ({ item }: { item: UnifiedPositionItem }) =>
    item.kind === "borrow" ? (
      <BorrowPositionsListItem position={item.position} />
    ) : (
      <EarnPositionsListItem item={item.position} />
    )
);
