import { useTranslation } from "react-i18next";
import { Box, Button, Heading, Text } from "../../components";
import { PageContainer } from "../components";
import { CheckCircleIcon } from "../../components/atoms/icons/check-circle";
import { useComplete } from "./use-complete";
import { TokenIcon } from "../../components/atoms/token-icon";
import { ActionTypes, TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import { useMatch, useParams } from "react-router-dom";
import { usePositionData } from "../../hooks/use-position-data";
import BigNumber from "bignumber.js";
import { formatTokenBalance } from "../../utils";
import { useStakeState } from "../../state/stake";
import { useUnstakeOrPendingActionState } from "../../state/unstake-or-pending-action";
import { useMemo } from "react";

type Props = {
  token: TokenDto | null;
  metadata: YieldMetadataDto | null;
  network: string;
  amount: string;
  pendingActionType?: ActionTypes;
};

const CompletePage = ({
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

        <Box display="flex" alignItems="flex-end">
          <Button onClick={onClick}>{t("shared.ok")}</Button>
        </Box>
      </Box>
    </PageContainer>
  );
};

export const StakeCompletePage = () => {
  const { stakeAmount, selectedStake } = useStakeState();

  const token = selectedStake.map((y) => y.token).extractNullable();
  const metadata = selectedStake.map((y) => y.metadata).extractNullable();

  const network = selectedStake.mapOrDefault((y) => y.token.symbol, "");

  const amount = stakeAmount.mapOrDefault((a) => a.toString(), "");

  return (
    <CompletePage
      token={token}
      metadata={metadata}
      network={network}
      amount={amount}
    />
  );
};

export const UnstakeOrPendingActionCompletePage = () => {
  const { unstake, pendingActionSession } = useUnstakeOrPendingActionState();

  const pendingActionMatch = useMatch(
    "pending-action/:integrationId/:defaultOrValidatorId/complete"
  );

  const integrationId = useParams<{ integrationId: string }>().integrationId!;

  const { position } = usePositionData(integrationId);

  const token = position.map((p) => p.integrationData.token).extractNullable();
  const metadata = position
    .map((p) => p.integrationData.metadata)
    .extractNullable();
  const network = token?.symbol ?? "";
  const amount = useMemo(
    () =>
      pendingActionMatch
        ? pendingActionSession.mapOrDefault(
            (val) => formatTokenBalance(new BigNumber(val.amount ?? 0), 6),
            ""
          )
        : unstake
            .chain((u) => u.amount)
            .mapOrDefault((a) => formatTokenBalance(a, 6), ""),
    [pendingActionMatch, pendingActionSession, unstake]
  );

  const pendingActionType = pendingActionSession
    .map((val) => val.type)
    .extract();

  return (
    <CompletePage
      token={token}
      metadata={metadata}
      network={network}
      amount={amount}
      pendingActionType={pendingActionType}
    />
  );
};
