import { List, Maybe } from "purify-ts";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../../components/atoms/content-loader";
import { SKLink } from "../../../../components/atoms/link";
import { ListItem } from "../../../../components/atoms/list/list-item";
import { Spinner } from "../../../../components/atoms/spinner";
import { TokenIcon } from "../../../../components/atoms/token-icon";
import { ToolTip } from "../../../../components/atoms/tooltip";
import { Text } from "../../../../components/atoms/typography/text";
import type { PositionDetailsLabelType } from "../../../../domain/types/positions";
import { getYieldProviderDetails } from "../../../../domain/types/yields";
import { usePositionListItem } from "../hooks/use-position-list-item";
import type { usePositions } from "../hooks/use-positions";
import { listItemContainer, viaText } from "../style.css";
import {
  listItem,
  noWrap,
  positionInfoColumn,
  positionName,
  rewardRateText,
} from "./styles.css";

export const PositionsListItem = memo(
  ({
    item,
  }: {
    item: ReturnType<typeof usePositions>["positionsData"]["data"][number];
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

    return (
      <SKLink
        relative="path"
        to={`../positions/${item.integrationId}/${item.balanceId}`}
      >
        <Box py="1">
          {integrationData.mapOrDefault(
            (d) => (
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
                    {item.token.mapOrDefault(
                      (val) => (
                        <TokenIcon
                          metadata={{
                            logoURI: d.metadata.logoURI,
                            name: d.metadata.name,
                            provider: getYieldProviderDetails(d) ?? undefined,
                          }}
                          token={val}
                        />
                      ),
                      <Box display="flex" marginRight="2">
                        <Spinner />
                      </Box>
                    )}

                    <Box className={positionInfoColumn}>
                      <Box display="flex" alignItems="center" gap="1">
                        <Text className={positionName}>{d.metadata.name}</Text>

                        {item.yieldLabelDto
                          .map((label) => (
                            <ToolTip
                              textAlign="left"
                              maxWidth={300}
                              label={t(
                                `position_details.labels.${label.type as PositionDetailsLabelType}.details`,
                                label.params as
                                  | Record<string, string>
                                  | undefined
                              )}
                            >
                              <Box
                                className={listItemContainer({
                                  type: "actionRequired",
                                })}
                              >
                                <Text
                                  variant={{ type: "white" }}
                                  className={noWrap}
                                >
                                  {t(
                                    `position_details.labels.${label.type as PositionDetailsLabelType}.label`
                                  )}
                                </Text>
                              </Box>
                            </ToolTip>
                          ))
                          .extractNullable()}

                        {(item.actionRequired ||
                          item.hasPendingClaimRewards ||
                          !!inactiveValidator) && (
                          <Box
                            className={listItemContainer({
                              type: item.actionRequired
                                ? "actionRequired"
                                : inactiveValidator
                                  ? "actionRequired"
                                  : "claim",
                            })}
                          >
                            <Text
                              variant={{ type: "white" }}
                              className={noWrap}
                            >
                              {t(
                                item.actionRequired
                                  ? "positions.action_required"
                                  : inactiveValidator
                                    ? inactiveValidator === "jailed"
                                      ? "details.validators_jailed"
                                      : "details.validators_inactive"
                                    : "positions.claim_rewards"
                              )}
                            </Text>
                          </Box>
                        )}
                      </Box>

                      {providersDetails
                        .chain((val) =>
                          List.head(val).map((p) => (
                            <Text
                              className={viaText}
                              variant={{ type: "muted", weight: "normal" }}
                            >
                              {t("positions.via", {
                                providerName: p.name ?? p.address,
                                count: Math.max(val.length - 1, 1),
                              })}
                            </Text>
                          ))
                        )
                        .extractNullable()}
                    </Box>
                  </Box>

                  <Box
                    display="flex"
                    alignItems="center"
                    gap="4"
                    flexShrink={0}
                  >
                    {!item.actionRequired &&
                      rewardRateAverage
                        .map((v) => <Text className={rewardRateText}>{v}</Text>)
                        .extractNullable()}

                    {Maybe.fromRecord({
                      amount: totalAmountFormatted,
                      token: item.token,
                    })
                      .map((val) => (
                        <Box
                          display="flex"
                          flexDirection="column"
                          alignItems="flex-end"
                          textAlign="end"
                          gap="1"
                        >
                          <Text className={noWrap}>
                            {val.amount} {val.token.symbol}
                          </Text>

                          {totalAmountPriceFormatted
                            .map((price) => (
                              <Text
                                className={noWrap}
                                variant={{ type: "muted", weight: "normal" }}
                              >
                                ≈ ${price}
                              </Text>
                            ))
                            .extractNullable()}
                        </Box>
                      ))
                      .extractNullable()}
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
                        <TokenIcon
                          token={val.token}
                          hideNetwork
                          tokenLogoHw="5"
                        />

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
            ),
            <ContentLoaderSquare heightPx={60} />
          )}
        </Box>
      </SKLink>
    );
  }
);
