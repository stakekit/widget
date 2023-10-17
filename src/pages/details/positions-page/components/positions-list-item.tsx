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
import { claimRewardsContainer, viaText } from "../style.css";
import { useProviderDetails } from "../../../../hooks/use-provider-details";
import { ImportValidator } from "./import-validator";

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

    const providerDetails = useProviderDetails({
      integrationData,
      validatorAddress: Maybe.of(item.defaultOrValidatorId),
    });

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
                        .map((t) => <Text>{t.symbol}</Text>)
                        .extractNullable()}

                      {hasPendingClaimRewards && (
                        <Box className={claimRewardsContainer}>
                          <Text variant={{ type: "white" }}>
                            {t("positions.claim_rewards")}
                          </Text>
                        </Box>
                      )}
                    </Box>
                    {providerDetails
                      .map((val) => (
                        <Text
                          className={viaText}
                          variant={{
                            type: "muted",
                            weight: "normal",
                          }}
                        >
                          {t("positions.via", {
                            providerName: val.name ?? val.address,
                          })}
                        </Text>
                      ))
                      .extractNullable()}
                  </Box>
                </Box>

                {Maybe.fromRecord({
                  token,
                  providerDetails,
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
                      <Text variant={{ weight: "normal" }}>
                        {val.providerDetails.aprPercentage}%
                      </Text>
                      <Text
                        variant={{
                          weight: "normal",
                          type: "muted",
                        }}
                      >
                        {formatNumber(amount)} {val.token.symbol}
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
    <ListItem variant={{ hover: "disabled" }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        gap="2"
        marginBottom="2"
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
  );
};
