import { Box } from "@sk-widget/components/atoms/box";
import { Divider } from "@sk-widget/components/atoms/divider";
import { container } from "@sk-widget/pages-dashboard/overview/earn-page/styles.css";
import { ExtraArgsSelection } from "@sk-widget/pages/details/earn-page/components/extra-args-selection";
import { Footer } from "@sk-widget/pages/details/earn-page/components/footer";
import { SelectTokenSection } from "@sk-widget/pages/details/earn-page/components/select-token-section";
import { SelectTokenTitle } from "@sk-widget/pages/details/earn-page/components/select-token-section/title";
import { SelectValidatorSection } from "@sk-widget/pages/details/earn-page/components/select-validator-section";
import { SelectYieldSection } from "@sk-widget/pages/details/earn-page/components/select-yield-section";
import { StakedVia } from "@sk-widget/pages/details/earn-page/components/select-yield-section/staked-via";
import { EarnPageContextProvider } from "@sk-widget/pages/details/earn-page/state/earn-page-context";
import { EarnPageStateUsageBoundaryProvider } from "@sk-widget/pages/details/earn-page/state/earn-page-state-context";
import { useSettings } from "@sk-widget/providers/settings";

export const EarnPage = () => {
  const { variant } = useSettings();

  return (
    <EarnPageStateUsageBoundaryProvider>
      <EarnPageContextProvider>
        <Box className={container}>
          <Box>
            <SelectTokenTitle />

            <SelectTokenSection />

            <SelectYieldSection />

            <StakedVia />

            <SelectValidatorSection />

            <ExtraArgsSelection />
          </Box>

          {variant === "utila" && <Divider />}

          <Box>
            <Footer />
          </Box>
        </Box>
      </EarnPageContextProvider>
    </EarnPageStateUsageBoundaryProvider>
  );
};
