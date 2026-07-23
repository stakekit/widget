import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../app/config/use-widget-config";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Button } from "../../../../../shared/ui/primitives/button";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useMountAnimation } from "../../../../mount-animation/react/use-mount-animation";
import { useTrackPage } from "../../../../tracking/react/use-track-page";
import { ZerionChainModal } from "../../../../wallet/ui/zerion-chain-modal";
import { PageContainer } from "../../../../widget-shell/page-container";
import { PageCtaButton } from "../../../../widget-shell/page-cta";
import { KycGateCard } from "../../components/kyc-gate-card";
import { ExtraArgsSelection } from "./components/extra-args-selection";
import { Footer } from "./components/footer";
import { SelectProvider } from "./components/select-provider";
import { SelectTokenSection } from "./components/select-token-section";
import { SelectTokenTitle } from "./components/select-token-section/title";
import { SelectValidatorSection } from "./components/select-validator-section";
import { SelectYieldSection } from "./components/select-yield-section";
import {
  EarnPageModelBinding,
  useEarnPageModel,
} from "./state/earn-page-model";

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

const EarnPageComponent = () => {
  useTrackPage("earn");

  const { t } = useTranslation();

  const variant = useWidgetConfig("variant");

  const { canRetry, cta, isError, onRetry } = useEarnPageModel();

  return (
    <PageContainer>
      <Box>
        {variant !== "zerion" && <SelectTokenTitle />}

        <ZerionChainModal />

        <SelectTokenSection />

        <SelectYieldSection />

        <EarnKycGateSection />

        <SelectProvider />

        <SelectValidatorSection />

        <ExtraArgsSelection />
      </Box>

      {isError && (
        <Box
          display="flex"
          alignItems="center"
          flexDirection="column"
          gap="2"
          justifyContent="center"
          my="4"
        >
          <Text variant={{ type: "danger" }} textAlign="center">
            {t("shared.something_went_wrong")}
          </Text>
          {canRetry && (
            <Button data-rk="earn-retry" onClick={onRetry}>
              {t("shared.retry")}
            </Button>
          )}
        </Box>
      )}

      <Box marginTop="4">
        <Footer />
      </Box>

      <PageCtaButton cta={cta} />
    </PageContainer>
  );
};

const EarnPage = () => (
  <EarnPageModelBinding>
    <EarnPageComponent />
  </EarnPageModelBinding>
);

export const AnimatedEarnPage = () => {
  const { mountAnimationFinished, dispatch } = useMountAnimation();
  const disableInitLayoutAnimation = useWidgetConfig(
    "disableInitLayoutAnimation"
  );

  const getAnimation = () => {
    if (mountAnimationFinished) {
      return {
        transition: { duration: 0.3, delay: 0 },
        initial: { opacity: 0, translateY: "-10px" as string | number },
      };
    }
    if (disableInitLayoutAnimation) {
      return {
        transition: { duration: 0, delay: 0 },
        initial: { opacity: 1, translateY: 0 },
      };
    }
    return {
      transition: { duration: 1, delay: 0.8 },
      initial: { opacity: 0, translateY: "-40px" },
    };
  };
  const animation = getAnimation();
  const initial = animation.initial;
  const animate = {
    opacity: 1,
    translateY: 0,
    transition: animation.transition,
  };

  return (
    <motion.div
      initial={initial}
      animate={animate}
      onAnimationComplete={(def: typeof animate) => {
        if (def.translateY !== 0 || mountAnimationFinished) return;

        dispatch({ type: "earnPage" });
      }}
    >
      <EarnPage />
    </motion.div>
  );
};
