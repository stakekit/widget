import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../app/composition/use-widget-config";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { Divider } from "../../../../../shared/ui/components/divider";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useEarnPageStatus } from "../../../react/use-earn-facades";
import { ExtraArgsSelection } from "../../classic/earn-page/components/extra-args-selection";
import { Footer } from "../../classic/earn-page/components/footer";
import { SelectTokenSection } from "../../classic/earn-page/components/select-token-section";
import { SelectTokenTitle } from "../../classic/earn-page/components/select-token-section/title";
import { SelectYieldSection } from "../../classic/earn-page/components/select-yield-section";
import { EarnKycGate } from "../../components/earn-kyc-gate";
import { EarnPageCta } from "../../components/earn-page-cta";
import { container, selectTokenTitleContainer } from "./styles.css";

export const EarnPageContent = ({
  registerFooterButton = true,
}: {
  readonly registerFooterButton?: boolean;
}) => {
  const { t } = useTranslation();
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const variant = useWidgetConfig("variant");
  const { view: status } = useEarnPageStatus();

  return (
    <Box className={container}>
      <Box>
        <Box
          className={combineRecipeWithVariant({
            rec: selectTokenTitleContainer,
            variant,
          })}
        >
          <SelectTokenTitle />
        </Box>

        <SelectTokenSection />

        <SelectYieldSection />

        <EarnKycGate />

        <ExtraArgsSelection />
      </Box>

      {(dashboardVariant || variant === "utila" || variant === "porto") && (
        <Divider />
      )}

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
