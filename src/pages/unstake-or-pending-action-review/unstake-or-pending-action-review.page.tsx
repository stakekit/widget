import { Trans, useTranslation } from "react-i18next";
import { Box, Divider, Heading, Text } from "../../components";
import { TokenIcon } from "../../components/atoms/token-icon";
import { PageContainer } from "../components";
import { useUnstakeOrPendingActionReview } from "./use-unstake-or-pending-action-review.hook";
import { RewardTokenDetails } from "../../components/molecules/reward-token-details";
import { Maybe } from "purify-ts";
import { HelpModal } from "../../components/molecules/help-modal";
import { feeStyles } from "../review/style.css";
import { pointer } from "./styles.css";
import { useTrackPage } from "../../hooks/tracking/use-track-page";
import { useTrackEvent } from "../../hooks/tracking/use-track-event";
import { AnimationPage } from "../../navigation/containers/animation-page";

export const UnstakeOrPendingActionReviewPage = () => {
  const {
    integrationData,
    amount,
    title,
    fee,
    rewardTokenDetailsProps,
    pendingActionMatch,
  } = useUnstakeOrPendingActionReview();

  const trackEvent = useTrackEvent();

  useTrackPage(pendingActionMatch ? "pendingActionReview" : "unstakeReview");

  const { t } = useTranslation();

  return Maybe.fromRecord({
    integrationData,
    amount,
    title,
  })
    .map((val) => (
      <AnimationPage>
        <PageContainer>
          <Box>
            <Box marginBottom="4">
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                marginBottom="1"
              >
                <Heading variant={{ level: "h1" }}>{val.title}</Heading>
                <TokenIcon
                  token={val.integrationData.token}
                  metadata={val.integrationData.metadata}
                />
              </Box>

              <Heading variant={{ level: "h1" }}>
                {val.amount} {val.integrationData.token.symbol}
              </Heading>
            </Box>

            <Divider />

            {rewardTokenDetailsProps
              .map((val) => (
                <>
                  <Box my="4">
                    <RewardTokenDetails {...val} />
                  </Box>

                  <Divider />
                </>
              ))
              .extractNullable()}

            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              marginTop="3"
            >
              <Text variant={{ weight: "semibold" }}>{t("shared.fees")}</Text>
              <HelpModal modal={{ type: "fees" }} />
            </Box>

            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              my="1"
              data-testid="estimated_gas_fee"
            >
              <Text variant={{ weight: "normal", type: "muted" }}>
                {t("review.estimated_gas_fee")}
              </Text>
              <Text
                className={feeStyles}
                variant={{ type: "muted", weight: "normal" }}
              >
                {fee}
              </Text>
            </Box>

            <Box marginTop="4" marginBottom="12">
              <Text variant={{ weight: "normal", type: "muted" }}>
                <Trans
                  i18nKey="unstake_review.terms_of_use"
                  components={{
                    underline0: (
                      // eslint-disable-next-line jsx-a11y/anchor-has-content
                      <a
                        target="_blank"
                        onClick={() => trackEvent("termsClicked")}
                        href="https://docs.stakek.it/docs/terms-of-use"
                        className={pointer}
                        rel="noreferrer"
                      />
                    ),
                  }}
                />
              </Text>
            </Box>
          </Box>
        </PageContainer>
      </AnimationPage>
    ))
    .extractNullable();
};
