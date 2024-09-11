import { ToolTip } from "@sk-widget/components/atoms/tooltip";
import type { PositionDetailsLabelType } from "@sk-widget/domain/types/positions";
import { usePositionListItem } from "@sk-widget/pages/details/positions-page/hooks/use-position-list-item";
import { List, Maybe } from "purify-ts";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Box, Spinner, Text } from "../../../../components";
import { ContentLoaderSquare } from "../../../../components/atoms/content-loader";
import { SKLink } from "../../../../components/atoms/link";
import { ListItem } from "../../../../components/atoms/list/list-item";
import { TokenIcon } from "../../../../components/atoms/token-icon";
import type { usePositions } from "../hooks/use-positions";
import {
  listItemContainer,
  positionDetailsContainer,
  viaText,
} from "../style.css";
import { ImportValidator } from "./import-validator";
import { listItem, noWrap } from "./styles.css";

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
                  justifyContent="space-between"
                  gap="2"
                >
                  <Box
                    display="flex"
                    justifyContent="flex-start"
                    alignItems="center"
                  >
                    {item.token.mapOrDefault(
                      (val) => (
                        <TokenIcon metadata={d.metadata} token={val} />
                      ),
                      <Box display="flex" marginRight="2">
                        <Spinner />
                      </Box>
                    )}

                    <Box
                      display="flex"
                      flexDirection="column"
                      justifyContent="center"
                      alignItems="flex-start"
                      gap="1"
                    >
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
                          inactiveValidator) && (
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

                  {Maybe.fromRecord({
                    token: item.token,
                    rewardRateAverage,
                  })
                    .map((val) => (
                      <Box
                        display="flex"
                        justifyContent="center"
                        alignItems="flex-end"
                        flexDirection="column"
                        textAlign="end"
                        gap="1"
                      >
                        <Text variant={{ weight: "normal" }}>
                          {item.actionRequired ? " " : val.rewardRateAverage}
                        </Text>

                        <Text
                          overflowWrap="anywhere"
                          variant={{ weight: "normal", type: "muted" }}
                        >
                          {item.amount} {val.token.symbol}
                        </Text>
                      </Box>
                    ))
                    .extractNullable()}
                </Box>

                {item.pointsRewardTokenBalance
                  .map((val) => (
                    <Box
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
                  ))
                  .extractNullable()}
              </ListItem>
            ),
            <ContentLoaderSquare heightPx={60} />
          )}
        </Box>
      </SKLink>
    );
  }
);

export const ImportValidatorListItem = ({
  importValidators,
}: {
  importValidators: ReturnType<typeof usePositions>["importValidators"];
}) => {
  const { t } = useTranslation();

  return (
    <Box py="1">
      <ListItem variant={{ hover: "disabled" }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          gap="2"
        >
          <Box display="flex" flexDirection="column" gap="2" flex={2}>
            <Text variant={{ weight: "bold" }}>
              {t("positions.dont_see_position")}
            </Text>

            <Text variant={{ weight: "normal", type: "muted" }}>
              {t("positions.import_validator")}
            </Text>
          </Box>

          <Box
            flex={1}
            display="flex"
            justifyContent="flex-end"
            alignItems="center"
          >
            <ImportValidator {...importValidators} />
          </Box>
        </Box>
      </ListItem>
    </Box>
  );
};
