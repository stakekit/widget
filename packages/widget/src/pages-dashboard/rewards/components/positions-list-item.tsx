import { List } from "purify-ts";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../components/atoms/content-loader";
import { SKLink } from "../../../components/atoms/link";
import { ListItem } from "../../../components/atoms/list/list-item";
import { Spinner } from "../../../components/atoms/spinner";
import { TokenIcon } from "../../../components/atoms/token-icon";
import { ToolTip } from "../../../components/atoms/tooltip";
import { Text } from "../../../components/atoms/typography/text";
import type { PositionDetailsLabelType } from "../../../domain/types/positions";
import {
  columnContainer,
  listItem,
  noWrap,
  overflowText,
} from "../../../pages/details/positions-page/components/styles.css";
import type { usePositions } from "../../../pages/details/positions-page/hooks/use-positions";
import { usePositionListItem } from "../../overview/positions/hooks/use-position-list-item";
import {
  listItemContainer,
  positionDetailsContainer,
  viaText,
} from "../styles.css";

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
      rewardsAmountFormatted,
      rewardsAmountPriceFormatted,
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
                <Box display="flex" width="full" gap="1">
                  {/* Yield */}
                  <Box
                    display="flex"
                    justifyContent="flex-start"
                    alignItems="center"
                    flex={5}
                  >
                    {item.token.mapOrDefault(
                      (val) => (
                        <TokenIcon metadata={d.metadata} token={val} />
                      ),
                      <Box display="flex" marginRight="2">
                        <Spinner />
                      </Box>
                    )}

                    <Box className={columnContainer}>
                      <Box className={positionDetailsContainer}>
                        {item.token
                          .map((t) => <Text>{t.symbol}</Text>)
                          .extractNullable()}

                        {item.yieldLabelDto
                          .map((label) => {
                            return (
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
                            );
                          })
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
                              variant={{
                                type: "muted",
                                weight: "normal",
                              }}
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

                  {/* Reward Rate */}
                  <Box flex={3} className={columnContainer}>
                    {rewardRateAverage
                      .map((v) => <Text className={overflowText}>{v}</Text>)
                      .orDefaultLazy(() => (
                        <Text style={{ textAlign: "center" }}>-</Text>
                      ))}
                  </Box>

                  {/* Rewards */}
                  <Box flex={2} className={columnContainer}>
                    {rewardsAmountFormatted
                      .map((v) => (
                        <>
                          <Text className={overflowText}>{v}</Text>

                          <Text
                            variant={{ weight: "normal" }}
                            className={overflowText}
                          >
                            {rewardsAmountPriceFormatted
                              .map((v) => <>{v}$</>)
                              .orDefault(
                                <Text style={{ textAlign: "center" }}>-</Text>
                              )}
                          </Text>
                        </>
                      ))
                      .orDefault(
                        <Text style={{ textAlign: "center" }}>-</Text>
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
