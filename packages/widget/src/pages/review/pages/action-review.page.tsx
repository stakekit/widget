import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { Divider } from "../../../components/atoms/divider";
import { InfoIcon } from "../../../components/atoms/icons/info";
import { ToolTip } from "../../../components/atoms/tooltip";
import { Text } from "../../../components/atoms/typography/text";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { AnimationPage } from "../../../navigation/containers/animation-page";
import { capitalizeFirstLetters } from "../../../utils/formatters";
import { PageContainer } from "../../components/page-container";
import { useActionReview } from "../hooks/use-action-review.hook";
import ReviewTopSection from "./common-page/components/review-top-section";
import { pointerStyles } from "./style.css";

export const ActionReviewPage = () => {
  const { t } = useTranslation();
  const trackEvent = useTrackEvent();
  const {
    selectedYield,
    transactions,
    title,
    amount,
    inputToken,
    actionOlderThan7Days,
    labelKey,
  } = useActionReview();

  const info = useMemo(
    () =>
      Maybe.fromNullable(selectedYield.token)
        .map((val) => `${amount} ${val.symbol}`)
        .extractNullable(),
    [amount, selectedYield.token]
  );

  return (
    <AnimationPage>
      <PageContainer>
        <ReviewTopSection
          info={info}
          metadata={Maybe.of(selectedYield.metadata)}
          token={inputToken}
          title={title}
        />
        <Divider />
        <Text marginTop="4" marginBottom="2">
          {t("activity.review.transactions")}:
        </Text>
        {transactions
          .map((stx) =>
            stx.map((tx) => (
              <Box
                marginBottom="2"
                display="flex"
                justifyContent="space-between"
                key={tx.id}
              >
                <Text as="span" color="textMuted">
                  {capitalizeFirstLetters(tx.type)}
                </Text>
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  gap="1"
                >
                  <Text color="textMuted">
                    {Maybe.of(tx.status)
                      .map((tx) => tx.replaceAll("_", " "))
                      .map(capitalizeFirstLetters)
                      .extract()}
                  </Text>
                  {Maybe.fromNullable(tx.error)
                    .map((e) => (
                      <ToolTip maxWidth={300} label={e}>
                        <InfoIcon />
                      </ToolTip>
                    ))
                    .extractNullable()}
                </Box>
              </Box>
            ))
          )
          .extractNullable()}
        <Divider my="2" />
        {!actionOlderThan7Days && (
          <Box marginTop="4" marginBottom="16">
            <Text variant={{ weight: "normal", type: "muted" }}>
              <Trans
                i18nKey="activity.review.terms_of_use"
                values={{ action: t(`activity.review.${labelKey}`) }}
                components={{
                  underline0: (
                    // biome-ignore lint: false
                    <a
                      target="_blank"
                      onClick={() => trackEvent("termsClicked")}
                      href="https://docs.yield.xyz/docs/terms-of-use"
                      className={pointerStyles}
                      rel="noreferrer"
                    />
                  ),
                }}
              />
            </Text>
          </Box>
        )}
      </PageContainer>
    </AnimationPage>
  );
};
