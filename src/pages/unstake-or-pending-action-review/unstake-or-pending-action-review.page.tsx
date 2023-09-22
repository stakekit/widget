import { Trans, useTranslation } from "react-i18next";
import { Box, Button, Divider, Heading, Text } from "../../components";
import { TokenIcon } from "../../components/atoms/token-icon";
import { PageContainer } from "../components";
import { useUnstakeOrPendingActionReview } from "./use-unstake-or-pending-action-review.hook";
import { RewardTokenDetails } from "../../components/molecules/reward-token-details";
import { Maybe } from "purify-ts";
import { HelpModal } from "../../components/molecules/help-modal";
import { feeStyles } from "../review/style.css";

export const UnstakeOrPendingActionReviewPage = () => {
  const {
    integrationData,
    amount,
    text,
    onClick,
    fee,
    pendingActionMatch,
    pendingActionText,
    pendingActionType,
  } = useUnstakeOrPendingActionReview();

  const { t } = useTranslation();

  return Maybe.fromRecord({
    integrationData,
    amount,
    text,
  })
    .map((val) => (
      <PageContainer>
        <Box>
          <Box marginBottom="4">
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              marginBottom="1"
            >
              <Heading variant={{ level: "h1" }}>
                {pendingActionMatch ? pendingActionText.extract() : val.text}
              </Heading>
              <TokenIcon
                token={val.integrationData.token}
                metadata={val.integrationData.metadata}
              />
            </Box>

            <Heading variant={{ level: "h1" }}>
              {val.text} {val.integrationData.token.symbol}
            </Heading>
          </Box>

          <Divider />

          {val.integrationData.metadata.provider && (
            <>
              <Box my="4">
                <RewardTokenDetails
                  {...(pendingActionMatch
                    ? {
                        type: "pendingAction",
                        pendingAction: pendingActionType.extract()!,
                      }
                    : { type: "unstake" })}
                  rewardToken={Maybe.of({
                    logoUri: val.integrationData.metadata.provider.logoURI,
                    providerName: val.integrationData.metadata.provider.name,
                    symbol: val.integrationData.token.symbol,
                  })}
                />
              </Box>

              <Divider />
            </>
          )}

          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            marginTop="3"
          >
            <Text variant={{ weight: "semibold", size: "small" }}>
              {t("shared.fees")}
            </Text>
            <HelpModal modal={{ type: "fees" }} />
          </Box>

          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            my="1"
            data-testid="estimated_gas_fee"
          >
            <Text variant={{ size: "small", weight: "normal", type: "muted" }}>
              {t("review.estimated_gas_fee")}
            </Text>
            <Text
              className={feeStyles}
              variant={{ size: "small", type: "muted", weight: "normal" }}
            >
              {fee}
            </Text>
          </Box>

          <Box marginTop="4">
            <Text variant={{ size: "small", weight: "normal", type: "muted" }}>
              <Trans
                i18nKey="unstake_review.terms_of_use"
                components={{
                  underline0: <span style={{ textDecoration: "underline" }} />,
                }}
              />
            </Text>
          </Box>
        </Box>

        <Box
          flex={1}
          display="flex"
          justifyContent="center"
          alignItems="flex-end"
        >
          <Button
            onClick={onClick}
            variant={{ color: "primary", animation: "press" }}
          >
            {t("shared.confirm")}
          </Button>
        </Box>
      </PageContainer>
    ))
    .extractNullable();
};
