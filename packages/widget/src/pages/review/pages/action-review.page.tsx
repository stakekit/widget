import { Box, Divider, Text } from "@sk-widget/components";
import { InfoIcon } from "@sk-widget/components/atoms/icons/info";
import { ToolTip } from "@sk-widget/components/atoms/tooltip";
import { useActionReview } from "@sk-widget/pages/review/hooks/use-action-review.hook";
import ReviewTopSection from "@sk-widget/pages/review/pages/common-page/components/review-top-section";
import TermsOfUse from "@sk-widget/pages/review/pages/common-page/components/terms-of-use";
import { capitalizeFirstLetter } from "@sk-widget/utils/formatters";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AnimationPage } from "../../../navigation/containers/animation-page";
import { PageContainer } from "../../components";

export const ActionReviewPage = () => {
  const { t } = useTranslation();
  const { selectedYield, selectedAction, transactions } = useActionReview();

  const info = useMemo(
    () =>
      Maybe.fromNullable(selectedYield.token)
        .map((val) => `${selectedAction.amount} ${val.symbol}`)
        .extractNullable(),
    [selectedAction.amount, selectedYield.token]
  );

  return (
    <AnimationPage>
      <PageContainer>
        <ReviewTopSection
          info={info}
          metadata={Maybe.of(selectedYield.metadata)}
          token={Maybe.of(selectedYield.token)}
          title={selectedAction.type}
        />
        <Divider my="2" />

        {transactions
          .map((tx) => tx.sort((a, b) => a.stepIndex - b.stepIndex))
          .map((stx) =>
            stx.map((tx, i) => (
              <Box
                py="2"
                display="flex"
                justifyContent="space-between"
                key={tx.id}
              >
                <Text>
                  {t("activity.review.transaction", { txIndex: i + 1 })}{" "}
                  <Text as="span" color="textMuted">
                    {capitalizeFirstLetter(tx.type)}
                  </Text>
                </Text>
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  gap="1"
                >
                  <Text color="textMuted">
                    {Maybe.of(tx.status)
                      .map(capitalizeFirstLetter)
                      .map((tx) => tx.replaceAll("_", " "))
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

        <TermsOfUse />
      </PageContainer>
    </AnimationPage>
  );
};
