import { Trans, useTranslation } from "react-i18next";
import { Divider, Highlight } from "../../components";
import { Box } from "../../components/atoms/box";
import { Heading, Text } from "../../components/atoms/typography";
import { PageContainer } from "../components";
import { useReview } from "./use-review.hook";
import { feeStyles, heading, pointer } from "./style.css";
import { RewardTokenDetails } from "../../components/molecules/reward-token-details";
import { TokenIcon } from "../../components/atoms/token-icon";
import { HelpModal } from "../../components/molecules/help-modal";
import { Maybe } from "purify-ts";
import { useTrackPage } from "../../hooks/tracking/use-track-page";
import { useTrackEvent } from "../../hooks/tracking/use-track-event";
import { AnimationPage } from "../../navigation/containers/animation-page";
import { motion } from "framer-motion";

export const ReviewPage = () => {
  useTrackPage("stakeReview");

  const trackEvent = useTrackEvent();

  const { amount, fee, interestRate, yieldType, token, rewardToken, metadata } =
    useReview();

  const { t } = useTranslation();

  return (
    <AnimationPage>
      <PageContainer>
        <Box marginBottom="4">
          <motion.div
            initial={{ opacity: 0, translateY: "-20px" }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ duration: 1 }}
          >
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              marginBottom="1"
            >
              <Heading variant={{ level: "h1" }}>{yieldType}</Heading>
              {Maybe.fromRecord({ token, metadata })
                .map((val) => (
                  <TokenIcon token={val.token} metadata={val.metadata} />
                ))
                .extractNullable()}
            </Box>
          </motion.div>

          {token
            .map((val) => (
              <motion.div
                initial={{ opacity: 0, translateY: "-20px" }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ duration: 1, delay: 0.3 }}
              >
                <Heading variant={{ level: "h1" }} className={heading}>
                  <Trans
                    i18nKey="review.amount_and_earn"
                    values={{
                      amount,
                      tokenSymbol: val.symbol,
                      interestRate,
                    }}
                    components={{
                      highlight0: <Highlight />,
                      highlight1: <Highlight />,
                      highlight3: <Highlight />,
                    }}
                  />
                </Heading>
              </motion.div>
            ))
            .extractNullable()}

          <Box marginTop="2">
            <Text variant={{ type: "muted", weight: "normal" }}>
              {t("review.estimated_reward")}
            </Text>
          </Box>
        </Box>

        <Divider />

        {rewardToken
          .map(() => (
            <>
              <Box my="4">
                <RewardTokenDetails rewardToken={rewardToken} type="stake" />
              </Box>

              <Divider />
            </>
          ))
          .extractNullable()}

        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          marginTop="2"
        >
          <Text variant={{ weight: "semibold" }}>{t("shared.fees")}</Text>
          <HelpModal modal={{ type: "fees" }} />
        </Box>

        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          marginTop="2"
          marginBottom="4"
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

        <Divider />

        <Box marginTop="3" marginBottom="16">
          <Text variant={{ weight: "normal", type: "muted" }}>
            <Trans
              i18nKey="review.terms_of_use"
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
      </PageContainer>
    </AnimationPage>
  );
};
