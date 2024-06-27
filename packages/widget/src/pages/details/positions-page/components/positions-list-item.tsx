import { ToolTip } from "@sk-widget/components/atoms/tooltip";
import type { PositionDetailsLabelType } from "@sk-widget/domain/types/positions";
import type { YieldBalanceDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { List, Maybe, compare } from "purify-ts";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box, Spinner, Text } from "../../../../components";
import { ContentLoaderSquare } from "../../../../components/atoms/content-loader";
import { SKLink } from "../../../../components/atoms/link";
import { ListItem } from "../../../../components/atoms/list/list-item";
import { TokenIcon } from "../../../../components/atoms/token-icon";
import { useYieldOpportunity } from "../../../../hooks/api/use-yield-opportunity";
import { useProvidersDetails } from "../../../../hooks/use-provider-details";
import { formatNumber } from "../../../../utils";
import { getRewardRateFormatted } from "../../../../utils/formatters";
import { checkHasPendingClaimRewards } from "../../shared";
import type { usePositions } from "../hooks/use-positions";
import {
  listItemContainer,
  positionDetailsContainer,
  viaText,
} from "../style.css";
import { ImportValidator } from "./import-validator";
import { listItem, noWrap } from "./styles.css";

const priorityOrder: { [key in YieldBalanceDto["type"]]: number } = {
  available: 1,
  staked: 2,
  unstaking: 3,
  unstaked: 4,
  preparing: 5,
  locked: 6,
  unlocking: 7,
  rewards: 8,
};

export const PositionsListItem = memo(
  ({
    item,
  }: {
    item: ReturnType<typeof usePositions>["positionsData"]["data"][number];
  }) => {
    const { t } = useTranslation();

    const yieldLabelDto = useMemo(
      () =>
        List.find((b) => !!b.label, item.allBalances).chainNullable(
          (v) => v.label
        ),
      [item.allBalances]
    );

    const actionRequired = useMemo(
      () =>
        item.type === "default" &&
        item.balancesWithAmount.some(
          (b) => b.type === "locked" || b.type === "unstaked"
        ),
      [item.balancesWithAmount, item.type]
    );

    const yieldOpportunity = useYieldOpportunity(item.integrationId);

    const integrationData = useMemo(
      () => Maybe.fromNullable(yieldOpportunity.data),
      [yieldOpportunity.data]
    );

    const amount = useMemo(
      () =>
        item.balancesWithAmount.reduce((acc, b) => {
          if (b.token.isPoints) return acc;

          return new BigNumber(b.amount).plus(acc);
        }, new BigNumber(0)),
      [item.balancesWithAmount]
    );

    const pointsRewardTokenBalance = useMemo(
      () => List.find((v) => !!v.token.isPoints, item.balancesWithAmount),
      [item.balancesWithAmount]
    );

    const token = useMemo(
      () =>
        List.head(
          List.sort(
            (a, b) => compare(priorityOrder[a.type], priorityOrder[b.type]),
            item.allBalances
          )
        ).map((v) => v.token),
      [item.allBalances]
    );

    const hasPendingClaimRewards = useMemo(
      () => checkHasPendingClaimRewards(item.balancesWithAmount),
      [item.balancesWithAmount]
    );

    const providersDetails = useProvidersDetails({
      integrationData,
      validatorsAddresses:
        item.type === "validators"
          ? Maybe.of(item.validatorsAddresses)
          : Maybe.of([]),
    });

    const rewardRateAverage = useMemo(
      () =>
        Maybe.fromRecord({ providersDetails, integrationData })
          .map((val) => ({
            ...val,
            rewardRateAverage: val.providersDetails
              .reduce(
                (acc, val) => acc.plus(new BigNumber(val.rewardRate || 0)),
                new BigNumber(0)
              )
              .dividedBy(val.providersDetails.length),
          }))
          .map((val) =>
            getRewardRateFormatted({
              rewardRate: val.rewardRateAverage.toNumber(),
              rewardType: val.integrationData.rewardType,
            })
          ),
      [integrationData, providersDetails]
    );

    const inactiveValidator = useMemo(
      () =>
        providersDetails
          .chain((val) => List.find((v) => v.status !== "active", val))
          .chainNullable((val) => val.status)
          .map((v) => v as Exclude<typeof v, "active">)
          .extractNullable(),
      [providersDetails]
    );

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
                  justifyContent="flex-start"
                  alignItems="center"
                >
                  {token.mapOrDefault(
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
                      {token
                        .map((t) => <Text>{t.symbol}</Text>)
                        .extractNullable()}

                      {yieldLabelDto
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

                      {(hasPendingClaimRewards ||
                        actionRequired ||
                        inactiveValidator) && (
                        <Box
                          className={listItemContainer({
                            type: hasPendingClaimRewards
                              ? "claim"
                              : "actionRequired",
                          })}
                        >
                          <Text variant={{ type: "white" }} className={noWrap}>
                            {t(
                              hasPendingClaimRewards
                                ? "positions.claim_rewards"
                                : inactiveValidator
                                  ? inactiveValidator === "jailed"
                                    ? "details.validators_jailed"
                                    : "details.validators_inactive"
                                  : "positions.action_required"
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
                  token,
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
                        {actionRequired ? " " : val.rewardRateAverage}
                      </Text>

                      <Text
                        overflowWrap="anywhere"
                        variant={{ weight: "normal", type: "muted" }}
                      >
                        {formatNumber(amount)} {val.token.symbol}
                      </Text>

                      {pointsRewardTokenBalance
                        .map((val) => (
                          <Box
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
                              {formatNumber(val.amount)}
                            </Text>
                          </Box>
                        ))
                        .extractNullable()}
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
