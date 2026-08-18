import { Trans, useTranslation } from "react-i18next";
import { capitalizeFirstLetters } from "../../../../../shared/lib/formatters";
import { Divider } from "../../../../../shared/ui/components/divider";
import { ToolTip } from "../../../../../shared/ui/components/tooltip";
import { Box } from "../../../../../shared/ui/primitives/box";
import { InfoIcon } from "../../../../../shared/ui/primitives/icons/info";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useTrackEvent } from "../../../../tracking/index";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
} from "../../../../widget-shell/views";
import { useActionReview } from "../hooks/use-action-review.hook.ts";
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
    actionExpired,
    labelKey,
    cta,
  } = useActionReview();

  const info = `${amount} ${selectedYield.token.symbol}`;

  return (
    <AnimationPage>
      <PageContainer>
        <ReviewTopSection
          info={info}
          metadata={{
            logoURI: selectedYield.metadata.logoURI,
            name: selectedYield.metadata.name,
            provider: selectedYield.provider,
          }}
          token={inputToken}
          title={title}
        />
        <Divider />
        <Text marginTop="4" marginBottom="2">
          {t("activity.review.transactions")}:
        </Text>
        {transactions.map((tx) => (
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
                {capitalizeFirstLetters(tx.status.replaceAll("_", " "))}
              </Text>
              {tx.error ? (
                <ToolTip maxWidth={300} label={tx.error}>
                  <InfoIcon />
                </ToolTip>
              ) : null}
            </Box>
          </Box>
        ))}
        <Divider my="2" />
        {!actionExpired && (
          <Box marginTop="4" marginBottom="4">
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
        <PageCtaButton cta={cta} />
      </PageContainer>
    </AnimationPage>
  );
};
