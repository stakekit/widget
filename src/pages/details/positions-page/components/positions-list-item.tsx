import BigNumber from "bignumber.js";
import { Box, Spinner, Text } from "../../../../components";
import { SKLink } from "../../../../components/atoms/link";
import { ListItem } from "../../../../components/atoms/list/list-item";
import { usePositions } from "../hooks/use-positions";
import { TokenIcon } from "../../../../components/atoms/token-icon";
import { apyToPercentage, formatTokenBalance } from "../../../../utils";
import { memo, useMemo } from "react";
import { List, Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";
import { useYieldOpportunity } from "../../../../hooks/api/use-yield-opportunity";
import { ContentLoaderSquare } from "../../../../components/atoms/content-loader";
import { claimRewardsContainer, viaText } from "../style.css";

export const PositionsListItem = memo(
  ({
    item,
  }: {
    item: ReturnType<typeof usePositions>["positionsData"]["data"][number];
  }) => {
    const { t } = useTranslation();

    const yieldOpportunity = useYieldOpportunity(item.integrationId);

    const integrationData = useMemo(
      () => Maybe.fromNullable(yieldOpportunity.data),
      [yieldOpportunity.data]
    );

    const amount = useMemo(
      () =>
        item.balances.reduce(
          (acc, b) => new BigNumber(b.amount).plus(acc),
          new BigNumber(0)
        ),
      [item.balances]
    );

    const token = List.head(item.balances).map((v) => v.token);

    const hasPendingClaimRewards = useMemo(
      () =>
        List.find((b) => b.type === "rewards", item.balances)
          .chain((b) =>
            List.find((a) => a.type === "CLAIM_REWARDS", b.pendingActions)
          )
          .isJust(),
      [item.balances]
    );

    const validator = useMemo(
      () =>
        item.defaultOrValidatorId === "default"
          ? integrationData.map((d) => ({
              providerName: d.metadata.provider?.name ?? d.metadata.name,
              apy: apyToPercentage(d.apy ?? 0),
            }))
          : integrationData
              .chain((d) =>
                List.find(
                  (v) => v.address === item.defaultOrValidatorId,
                  d.validators
                )
              )
              .map((v) => ({
                providerName: v.name ?? v.address,
                apy: apyToPercentage(v.apr ?? 0),
              })),
      [integrationData, item.defaultOrValidatorId]
    );

    return (
      <SKLink
        relative="path"
        to={`../positions/${item.integrationId}/${item.defaultOrValidatorId}`}
      >
        <Box my="2">
          {integrationData.mapOrDefault(
            (d) => (
              <ListItem>
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
                  >
                    <Box
                      display="flex"
                      justifyContent="center"
                      alignItems="center"
                      gap="1"
                    >
                      {token
                        .map((t) => (
                          <Text variant={{ size: "small" }}>{t.symbol}</Text>
                        ))
                        .extractNullable()}

                      {hasPendingClaimRewards && (
                        <Box className={claimRewardsContainer}>
                          <Text variant={{ size: "xsmall", type: "white" }}>
                            {t("positions.claim_rewards")}
                          </Text>
                        </Box>
                      )}
                    </Box>
                    {validator
                      .map((val) => (
                        <Text
                          className={viaText}
                          variant={{
                            size: "small",
                            type: "muted",
                            weight: "normal",
                          }}
                        >
                          {t("positions.via", {
                            providerName: val.providerName,
                          })}
                        </Text>
                      ))
                      .extractNullable()}
                  </Box>
                </Box>

                {Maybe.fromRecord({
                  token,
                  validator,
                })
                  .map((val) => (
                    <Box
                      display="flex"
                      justifyContent="center"
                      alignItems="flex-end"
                      flexDirection="column"
                      flex={2}
                      textAlign="end"
                    >
                      <Text variant={{ size: "small", weight: "normal" }}>
                        {val.validator.apy}%
                      </Text>
                      <Text
                        variant={{
                          size: "small",
                          weight: "normal",
                          type: "muted",
                        }}
                      >
                        {formatTokenBalance(amount, 6)} {val.token.symbol}
                      </Text>
                    </Box>
                  ))
                  .extractNullable()}
              </ListItem>
            ),
            <ContentLoaderSquare
              heightPx={60}
              uniqueKey="positions-page/position-list-item/loader"
            />
          )}
        </Box>
      </SKLink>
    );
  }
);
