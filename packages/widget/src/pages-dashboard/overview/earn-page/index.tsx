import { Box } from "@sk-widget/components/atoms/box";
import { Divider } from "@sk-widget/components/atoms/divider";
import {
  container,
  selectTokenTitleContainer,
  selectValidatorSectionContainer,
} from "@sk-widget/pages-dashboard/overview/earn-page/styles.css";
import { UtilaSelectValidatorSection } from "@sk-widget/pages-dashboard/overview/earn-page/utila-select-validator-section";
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
import { combineRecipeWithVariant } from "@sk-widget/utils/styles";

export const EarnPage = () => {
  const { variant } = useSettings();

  return (
    <EarnPageStateUsageBoundaryProvider>
      <EarnPageContextProvider>
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

            {variant === "utila" && (
              <Box
                className={combineRecipeWithVariant({
                  rec: selectValidatorSectionContainer,
                  variant,
                })}
              >
                <UtilaSelectValidatorSection />
              </Box>
            )}

            <SelectYieldSection />

            <StakedVia />

            {variant !== "utila" && <SelectValidatorSection />}

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
