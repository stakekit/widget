import { Virtuoso } from "react-virtuoso";
import { Box, Spinner, Text } from "../../../../components";
import { usePositions } from "./use-positions";
import { ListItem } from "../../../../components/atoms/list/list-item";
import { apyToPercentage, formatTokenBalance } from "../../../../utils";
import { TokenIcon } from "../../../../components/atoms/token-icon";
import { useTranslation } from "react-i18next";
import { claimRewardsContainer, virtuosoContainer } from "./style.css";
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
            <Box display="flex" flex={1} justifyContent="center">
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
            const balance = item.balanceData.balances.find(
              (b) => b.type === "staked" || b.type === "available"
            );

            if (!balance) return null;

            const amount = new BigNumber(balance.amount);

            const hasRewards = item.balanceData.balances
              .find((b) => b.type === "rewards")
              ?.pendingActions.some((a) => a.type === "CLAIM_REWARDS");

            return (
              <SKLink
                relative="path"
                to={`../positions/${item.integrationData.id}`}
              >
                <Box my="2">
                  <ListItem>
                    <Box
                      display="flex"
                      justifyContent="flex-start"
                      alignItems="center"
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

                          {hasRewards && (
                            <Box className={claimRewardsContainer}>
                              <Text variant={{ size: "xsmall", type: "white" }}>
                                {t("positions.claim_rewards")}
                              </Text>
                            </Box>
                          )}
                        </Box>
                        <Text
                          variant={{
                            size: "small",
                            type: "muted",
                            weight: "normal",
                          }}
                        >
                          {t("positions.via", {
                            providerName:
                              item.integrationData.metadata.provider?.name,
                          })}
                        </Text>
                      </Box>
                    </Box>

                    <Box
                      display="flex"
                      justifyContent="center"
                      alignItems="flex-end"
                      flexDirection="column"
                    >
                      <Text variant={{ size: "small", weight: "normal" }}>
                        {apyToPercentage(item.integrationData.apy)}%
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
