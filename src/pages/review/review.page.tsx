import { Trans, useTranslation } from "react-i18next";
import { Button, Divider, Highlight } from "../../components";
import { Box } from "../../components/atoms/box";
import { Heading, Text } from "../../components/atoms/typography";
import { PageContainer } from "../components";
import { useReview } from "./use-review.hook";
import { feeStyles, pointer, spanStyle } from "./style.css";
import { RewardTokenDetails } from "../../components/molecules/reward-token-details";
import { TokenIcon } from "../../components/atoms/token-icon";
import { HelpModal } from "../../components/molecules/help-modal";
import { Maybe } from "purify-ts";
import { useTrackPage } from "../../hooks/tracking/use-track-page";
import { useTrackEvent } from "../../hooks/tracking/use-track-event";

export const ReviewPage = () => {
  useTrackPage("stakeReview");

  const trackEvent = useTrackEvent();

  const {
    amount,
    fee,
    interestRate,
    yieldType,
    token,
    onClick,
    rewardToken,
    metadata,
  } = useReview();

  const { t } = useTranslation();

  return (
    <>
      <PageContainer>
        <Box marginBottom="4">
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

          {token
            .map((val) => (
              <Heading variant={{ level: "h1" }}>
                <Trans
                  i18nKey="review.amount_and_earn"
                  values={{
                    amount,
                    tokenSymbol: val.symbol,
                    interestRate,
                  }}
                  components={{
                    highlight0: <Highlight className={spanStyle} />,
                    highlight1: <Highlight className={spanStyle} />,
                    highlight3: <Highlight className={spanStyle} />,
                  }}
                />
              </Heading>
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

        <Box
          flex={1}
          display="flex"
          justifyContent="flex-end"
          flexDirection="column"
          marginTop="5"
        >
          <Button
            onClick={onClick}
            variant={{ color: "primary", animation: "press" }}
          >
            {t("shared.confirm")}
          </Button>
        </Box>
      </PageContainer>

      <Box background="backgroundMuted" px="6" py="6">
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
    </>
  );
};
