import { Box } from "../../../components/atoms/box";
import { Divider } from "../../../components/atoms/divider";
import { ExtraArgsSelection } from "../../../pages/details/earn-page/components/extra-args-selection";
import { Footer } from "../../../pages/details/earn-page/components/footer";
import { SelectTokenSection } from "../../../pages/details/earn-page/components/select-token-section";
import { SelectTokenTitle } from "../../../pages/details/earn-page/components/select-token-section/title";
import { SelectValidatorSection } from "../../../pages/details/earn-page/components/select-validator-section";
import { SelectYieldSection } from "../../../pages/details/earn-page/components/select-yield-section";
import { StakedVia } from "../../../pages/details/earn-page/components/select-yield-section/staked-via";
import { EarnPageContextProvider } from "../../../pages/details/earn-page/state/earn-page-context";
import { EarnPageStateUsageBoundaryProvider } from "../../../pages/details/earn-page/state/earn-page-state-context";
import { useSettings } from "../../../providers/settings";
import { combineRecipeWithVariant } from "../../../utils/styles";
import {
  container,
  selectTokenTitleContainer,
  selectValidatorSectionContainer,
} from "./styles.css";
import { UtilaSelectValidatorSection } from "./utila-select-validator-section";

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
