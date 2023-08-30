import { Virtuoso } from "react-virtuoso";
import { Box, Spinner, Text } from "../../../../components";
import { usePositions } from "./use-positions";
import { ListItem } from "../../../../components/atoms/list/list-item";
import { apyToPercentage, formatTokenBalance } from "../../../../utils";
import { TokenIcon } from "../../../../components/atoms/token-icon";
import { useTranslation } from "react-i18next";
import { claimRewardsContainer, viaText, virtuosoContainer } from "./style.css";
import BigNumber from "bignumber.js";
import { useSKWallet } from "../../../../hooks/wallet/use-sk-wallet";
import { SKLink } from "../../../../components/atoms/link";
import { ConnectButton } from "../../../../components/molecules/connect-button";

/**
 *
 * TODO:
 * - Reduce multiple "staked" positions to single amount
 * - Token price with price per share
 */

export const Positions = () => {
  const { tableData, isLoading } = usePositions();

  const { isConnected } = useSKWallet();

  const { t } = useTranslation();

  return (
    <Box display="flex" justifyContent="center" flex={1}>
      {(isLoading || !isConnected) && (
        <Box marginTop="2" flex={1}>
          {isLoading && (
            <Box
              marginBottom="2"
              display="flex"
              flex={1}
              justifyContent="center"
            >
              <Spinner />
            </Box>
          )}

          {!isConnected && (
            <Box flex={1}>
              <ConnectButton />
            </Box>
          )}
        </Box>
      )}

      {isConnected && !tableData?.length && !isLoading ? (
        <Box marginTop="2">
          <Text variant={{ weight: "medium", size: "small" }}>
            {t("positions.no_current_positions")}
          </Text>
        </Box>
      ) : null}

      {!!tableData?.length && (
        <Virtuoso
          className={virtuosoContainer}
          style={{ height: "auto" }}
          data={tableData}
          itemContent={(_index, item) => {
            const balance = item.balances.find(
              (b) => b.type === "staked" || b.type === "available"
            );

            if (!balance) return null;

            const amount = new BigNumber(balance.amount);

            const hasPendingClaimRewards = item.balances
              .find((b) => b.type === "rewards")
              ?.pendingActions.some((a) => a.type === "CLAIM_REWARDS");

            const validator = item.integrationData.validators.find(
              (v) => v.address === item.defaultOrValidatorId
            );

            const providerName =
              item.defaultOrValidatorId === "default"
                ? item.integrationData.metadata.provider?.name
                : validator?.name ?? "";

            return (
              <SKLink
                relative="path"
                to={`../positions/${item.integrationData.id}/${item.defaultOrValidatorId}`}
              >
                <Box my="2">
                  <ListItem>
                    <Box
                      display="flex"
                      justifyContent="flex-start"
                      alignItems="center"
                      flex={3}
                      minWidth="0"
                    >
                      <TokenIcon
                        metadata={item.integrationData.metadata}
                        token={balance.token}
                      />

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
                          <Text variant={{ size: "small" }}>
                            {balance.token.symbol}
                          </Text>

                          {hasPendingClaimRewards && (
                            <Box className={claimRewardsContainer}>
                              <Text variant={{ size: "xsmall", type: "white" }}>
                                {t("positions.claim_rewards")}
                              </Text>
                            </Box>
                          )}
                        </Box>
                        <Text
                          className={viaText}
                          variant={{
                            size: "small",
                            type: "muted",
                            weight: "normal",
                          }}
                        >
                          {t("positions.via", { providerName })}
                        </Text>
                      </Box>
                    </Box>

                    <Box
                      display="flex"
                      justifyContent="center"
                      alignItems="flex-end"
                      flexDirection="column"
                      flex={1}
                      textAlign="end"
                    >
                      <Text variant={{ size: "small", weight: "normal" }}>
                        {apyToPercentage(
                          validator?.apr ?? item.integrationData.apy
                        )}
                        %
                      </Text>
                      {balance.amount && (
                        <Text
                          variant={{
                            size: "small",
                            weight: "normal",
                            type: "muted",
                          }}
                        >
                          {formatTokenBalance(amount, 6)} {balance.token.symbol}
                        </Text>
                      )}
                    </Box>
                  </ListItem>
                </Box>
              </SKLink>
            );
          }}
        />
      )}
    </Box>
  );
};
