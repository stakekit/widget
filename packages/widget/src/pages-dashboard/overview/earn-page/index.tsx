import { Box } from "../../../components/atoms/box";
import { Divider } from "../../../components/atoms/divider";
import { KycGateCard } from "../../../components/molecules/kyc-gate-card";
import { ExtraArgsSelection } from "../../../pages/details/earn-page/components/extra-args-selection";
import { Footer } from "../../../pages/details/earn-page/components/footer";
import { SelectTokenSection } from "../../../pages/details/earn-page/components/select-token-section";
import { SelectTokenTitle } from "../../../pages/details/earn-page/components/select-token-section/title";
import { SelectYieldSection } from "../../../pages/details/earn-page/components/select-yield-section";
import {
  EarnPageContextProvider,
  useEarnPageContext,
} from "../../../pages/details/earn-page/state/earn-page-context";
import { EarnPageStateUsageBoundaryProvider } from "../../../pages/details/earn-page/state/earn-page-state-context";
import { useSettings } from "../../../providers/settings";
import { combineRecipeWithVariant } from "../../../utils/styles";
import { container, selectTokenTitleContainer } from "./styles.css";

const EarnKycGateSection = () => {
  const { kycGate, kycGateIsChecking, kycProviderName, onKycStatusRefresh } =
    useEarnPageContext();

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
  const { variant } = useSettings();

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

      {(variant === "utila" || variant === "porto") && <Divider />}

      <Box>
        <Footer />
      </Box>
    </Box>
  );
};

export const EarnPage = () => {
  return (
    <EarnPageStateUsageBoundaryProvider>
      <EarnPageContextProvider>
        <EarnPageContent />
      </EarnPageContextProvider>
    </EarnPageStateUsageBoundaryProvider>
  );
};
