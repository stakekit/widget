import { TokenIcon } from "@sk-widget/components/atoms/token-icon";
import { useFailedReview } from "@sk-widget/pages/review/hooks/use-failed-review.hook";
import { Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";
import { Divider } from "../../../components";
import { Box } from "../../../components/atoms/box";
import { Heading, Text } from "../../../components/atoms/typography";
import { AnimationPage } from "../../../navigation/containers/animation-page";
import { PageContainer } from "../../components";

export const FailedReviewPage = () => {
  const { t } = useTranslation();
  const { errorsList, selectedYield } = useFailedReview();

  return (
    <AnimationPage>
      <PageContainer>
        <Box flex={1} display="flex" flexDirection="column">
          {Maybe.fromNullable(selectedYield)
            .map((y) => (
              <>
                <Box display="flex" justifyContent="center" alignItems="center">
                  <TokenIcon
                    metadata={y.metadata}
                    token={y.token}
                    tokenLogoHw="14"
                  />
                </Box>
                <Box
                  marginTop="3"
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  flexDirection="column"
                >
                  <Heading variant={{ level: "h4" }} textAlign="center">
                    {y.metadata.name}
                  </Heading>
                  <Text variant={{ type: "muted" }}>{y.token.symbol}</Text>
                </Box>
              </>
            ))
            .unsafeCoerce()}
          <Divider my="4" />
          <Text marginBottom="2">Errors:</Text>
          {errorsList
            .map((error) => (
              <Text variant={{ weight: "normal", type: "muted" }}>{error}</Text>
            ))
            .orDefault(<p>{t("activity.failed_review.unknown_error")}</p>)}
        </Box>
      </PageContainer>
    </AnimationPage>
  );
};
