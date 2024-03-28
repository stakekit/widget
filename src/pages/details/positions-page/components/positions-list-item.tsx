import BigNumber from "bignumber.js";
import { Box, Spinner, Text } from "../../../../components";
import { SKLink } from "../../../../components/atoms/link";
import { ListItem } from "../../../../components/atoms/list/list-item";
import { usePositions } from "../hooks/use-positions";
import { TokenIcon } from "../../../../components/atoms/token-icon";
import { formatNumber } from "../../../../utils";
import { memo, useMemo } from "react";
import { List, Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";
import { useYieldOpportunity } from "../../../../hooks/api/use-yield-opportunity";
import { ContentLoaderSquare } from "../../../../components/atoms/content-loader";
import { listItemContainer, viaText } from "../style.css";
import { useProvidersDetails } from "../../../../hooks/use-provider-details";
import { ImportValidator } from "./import-validator";
import { checkHasPendingClaimRewards } from "../../shared";
import { getRewardRateFormatted } from "../../../../utils/formatters";
import { listItem, noWrap } from "./styles.css";

export const PositionsListItem = memo(
  ({
    item,
  }: {
    item: ReturnType<typeof usePositions>["positionsData"]["data"][number];
  }) => {
    const { t } = useTranslation();

    const actionRequired = useMemo(() => {
      return (
        item.type === "default" &&
        item.balances.some((b) => b.type === "locked" || b.type === "unstaked")
      );
    }, [item.balances, item.type]);

    const yieldOpportunity = useYieldOpportunity(item.integrationId);

    const integrationData = useMemo(
      () => Maybe.fromNullable(yieldOpportunity.data),
      [yieldOpportunity.data]
    );

    const amount = useMemo(
      () =>
        item.balances.reduce((acc, b) => {
          if (b.token.isPoints) return acc;

          return new BigNumber(b.amount).plus(acc);
        }, new BigNumber(0)),
      [item.balances]
    );

    const pointsRewardTokenBalance = useMemo(
      () => List.find((v) => !!v.token.isPoints, item.balances),
      [item.balances]
    );

    const token = List.head(item.balances).map((v) => v.token);

    const hasPendingClaimRewards = useMemo(
      () => checkHasPendingClaimRewards(item.balances),
      [item.balances]
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
                (acc, val) => acc.plus(new BigNumber(val.rewardRate)),
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
          .chain((val) => Maybe.fromNullable(val.status))
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
                  flex={3}
                  minWidth="0"
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
                    minWidth="0"
                    gap={
                      hasPendingClaimRewards ||
                      actionRequired ||
                      inactiveValidator
                        ? "1"
                        : "0"
                    }
                  >
                    <Box
                      display="flex"
                      justifyContent="center"
                      alignItems="center"
                      gap="2"
                    >
                      {token
                        .map((t) => <Text>{t.symbol}</Text>)
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
                      flex={2}
                      textAlign="end"
                      gap="1"
                    >
                      <Text variant={{ weight: "normal" }}>
                        {actionRequired ? " " : val.rewardRateAverage}
                      </Text>

                      <Text variant={{ weight: "normal", type: "muted" }}>
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

                            <Text variant={{ type: "muted", weight: "normal" }}>
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
