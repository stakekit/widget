import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../app/config/use-widget-config";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Button } from "../../../../../shared/ui/primitives/button";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { Divider } from "../../../../widget-shell/divider";
import { PageCtaButton } from "../../../../widget-shell/page-cta";
import { ExtraArgsSelection } from "../../classic/earn-page/components/extra-args-selection";
import { Footer } from "../../classic/earn-page/components/footer";
import { SelectTokenSection } from "../../classic/earn-page/components/select-token-section";
import { SelectTokenTitle } from "../../classic/earn-page/components/select-token-section/title";
import { SelectYieldSection } from "../../classic/earn-page/components/select-yield-section";
import { useEarnPageModel } from "../../classic/earn-page/state/earn-page-model";
import { KycGateCard } from "../../components/kyc-gate-card";
import { container, selectTokenTitleContainer } from "./styles.css";

const EarnKycGateSection = () => {
  const { kycGate, kycGateIsChecking, kycProviderName, onKycStatusRefresh } =
    useEarnPageModel();

  if (kycGate.state === "pass" && !kycGateIsChecking) return null;

  return (
    <Box marginTop="3">
      <KycGateCard
        gate={kycGate}
        isChecking={kycGateIsChecking}
        onCheckStatus={onKycStatusRefresh}
        providerName={kycProviderName}
      />
    </Box>
  );
};

export const EarnPageContent = () => {
  const { t } = useTranslation();
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const variant = useWidgetConfig("variant");
  const { canRetry, cta, isError, onRetry } = useEarnPageModel();

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

        <EarnKycGateSection />

        <ExtraArgsSelection />
      </Box>

      {(dashboardVariant || variant === "utila" || variant === "porto") && (
        <Divider />
      )}

      <Box>
        <Footer />
      </Box>

      {isError && (
        <Box alignItems="center" display="flex" flexDirection="column" gap="2">
          <Text textAlign="center" variant={{ type: "danger" }}>
            {t("shared.something_went_wrong")}
          </Text>
          {canRetry && (
            <Button data-rk="earn-dashboard-retry" onClick={onRetry}>
              {t("shared.retry")}
            </Button>
          )}
        </Box>
      )}

      <PageCtaButton cta={cta} />
    </Box>
  );
};
