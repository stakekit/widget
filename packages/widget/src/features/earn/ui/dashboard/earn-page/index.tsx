import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../features/widget-configuration/index";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { amountTokenSectionTitleContainer } from "../../../../../shared/ui/components/amount-token-section/styles.css";
import { Divider } from "../../../../../shared/ui/components/divider";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useEarnPageStatus } from "../../../react/use-earn-facades";
import { EarnKycGate } from "../../components/earn-kyc-gate";
import { EarnPageCta } from "../../components/earn-page-cta";
import { ExtraArgsSelection } from "../../components/extra-args-selection";
import { Footer } from "../../components/footer";
import { SelectTokenSection } from "../../components/select-token-section";
import { SelectTokenTitle } from "../../components/select-token-section/title";
import { SelectYieldSection } from "../../components/select-yield-section";
import { container } from "./styles.css";

export const EarnPageContent = ({
  registerFooterButton = true,
}: {
  readonly registerFooterButton?: boolean;
}) => {
  const { t } = useTranslation();
  const { earnPresentation } = useWidgetConfig("hostProfile");
  const variant = useWidgetConfig("variant");
  const { view: status } = useEarnPageStatus();

  return (
    <Box className={container}>
      <Box>
        <Box
          className={combineRecipeWithVariant({
            rec: amountTokenSectionTitleContainer,
            variant,
          })}
        >
          <SelectTokenTitle />
        </Box>

        <SelectTokenSection />

        <SelectYieldSection alwaysShowStrategy showRiskSummary={false} />

        <EarnKycGate />

        <ExtraArgsSelection showDivider={false} />
      </Box>

      {earnPresentation.condensed && <Divider />}

      <Box>
        <Footer />
      </Box>

      {status.isError && (
        <Box alignItems="center" display="flex" flexDirection="column" gap="2">
          <Text textAlign="center" variant={{ type: "danger" }}>
            {t("shared.something_went_wrong")}
          </Text>
        </Box>
      )}

      <EarnPageCta enabled={registerFooterButton} />
    </Box>
  );
};
