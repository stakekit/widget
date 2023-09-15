import { useTranslation } from "react-i18next";
import { Box, Button, Heading, Text } from "../../components";
import { PageContainer } from "../components";
import { CheckCircleIcon } from "../../components/atoms/icons/check-circle";
import { useComplete } from "./use-complete.hook";
import { TokenIcon } from "../../components/atoms/token-icon";
import { ActionTypes, TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";

type Props = {
  token: TokenDto | null;
  metadata: YieldMetadataDto | null;
  network: string;
  amount: string;
  pendingActionType?: ActionTypes;
};

export const CompletePage = ({
  amount,
  metadata,
  network,
  token,
  pendingActionType,
}: Props) => {
  const { t } = useTranslation();

  const {
    rewardTokenDetails,
    onClick,
    onViewTransactionClick,
    unstakeMatch,
    pendingActionMatch,
    hasUrs,
    yieldType,
  } = useComplete();

  return (
    <PageContainer>
      <Box
        flex={1}
        display="flex"
        flexDirection="column"
        justifyContent="space-between"
      >
        <Box
          flex={1}
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          textAlign="center"
        >
          {token && metadata && (
            <Box marginBottom="4">
              <TokenIcon
                metadata={metadata}
                tokenLogoHw="32"
                tokenNetworkLogoHw="8"
                token={token}
              />
            </Box>
          )}
          <Heading variant={{ level: "h3" }}>
            {t(
              unstakeMatch
                ? "complete.successfully_unstaked"
                : pendingActionMatch
                ? `complete.successfully_pending_action`
                : "complete.successfully_staked",
              {
                action: yieldType.mapOrDefault(
                  (yt) =>
                    unstakeMatch
                      ? t(`complete.unstake.${yt}`)
                      : t(`complete.stake.${yt}`),
                  ""
                ),
                amount,
                tokenNetwork: network,
                pendingAction: t(
                  `complete.pending_action.${
                    pendingActionType?.toLowerCase() as Lowercase<ActionTypes>
                  }`
                ),
              }
            )}
          </Heading>

          {rewardTokenDetails && (
            <Box display="flex" marginTop="2">
              {rewardTokenDetails.logoUri && (
                <Box
                  hw="5"
                  as="img"
                  src={rewardTokenDetails.logoUri}
                  marginRight="1"
                />
              )}
              <Text variant={{ type: "muted", size: "small" }}>
                {t("complete.via", {
                  providerName: rewardTokenDetails.providerName,
                })}
              </Text>
            </Box>
          )}

          {hasUrs && (
            <Box
              marginTop="4"
              display="flex"
              justifyContent="center"
              alignItems="center"
              as="button"
              onClick={onViewTransactionClick}
            >
              <Box
                marginRight="1"
                display="flex"
                justifyContent="center"
                alignItems="center"
              >
                <CheckCircleIcon width={22} height={22} />
              </Box>
              <Text variant={{ type: "muted", size: "small" }}>
                {t("complete.view_transaction")}
              </Text>
            </Box>
          )}
        </Box>

        <Box display="flex" alignItems="flex-end" marginTop="8">
          <Button onClick={onClick}>{t("shared.ok")}</Button>
        </Box>
      </Box>
    </PageContainer>
  );
};
