import { Text } from "../../../components/atoms/typography";
import { Box } from "../../../components/atoms/box";
import { PageContainer } from "../../components";
import { Spinner } from "../../../components";
import { Footer } from "./components/footer";
import { SelectValidatorSection } from "./components/select-validator-section";
import { HelpModal } from "../../../components/molecules/help-modal";
import { SelectTokenSection } from "./components/select-token-section";
import { SelectYieldSection } from "./components/select-yield-section";
import {
  DetailsContextProvider,
  useDetailsContext,
} from "./state/details-context";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { ExtraArgsSelection } from "./components/extra-args-selection";
import { motion } from "framer-motion";
import { useMountAnimationFinished } from "../../../navigation/containers/animation-layout";

const EarnPageComponent = () => {
  useTrackPage("earn");

  const {
    yieldType,
    isError,
    errorMessage,
    selectedStakeYieldType,
    isFetching,
    appLoading,
  } = useDetailsContext();

  const title = yieldType;

  const [mountAnimationFinished] = useMountAnimationFinished();

  return (
    <motion.div
      initial={{
        opacity: 0,
        translateY: mountAnimationFinished ? "-10px" : "-40px",
      }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        duration: mountAnimationFinished ? 0.3 : 1,
        delay: mountAnimationFinished ? 0 : 0.8,
      }}
    >
      <PageContainer>
        <Box>
          <Box>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
            >
              <Box display="flex" alignItems="center" minHeight="8">
                <Text>{title}</Text>
                {selectedStakeYieldType && (
                  <HelpModal modal={{ type: selectedStakeYieldType }} />
                )}
                {(isFetching || appLoading) && (
                  <Box display="flex" marginLeft="2">
                    <Spinner />
                  </Box>
                )}
              </Box>
            </Box>

            <SelectTokenSection />

            <SelectYieldSection />

            <SelectValidatorSection />

            <ExtraArgsSelection />
          </Box>

          {isError && (
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              my="4"
            >
              <Text variant={{ type: "danger" }} textAlign="center">
                {errorMessage}
              </Text>
            </Box>
          )}

          <Box marginTop="4">
            <Footer />
          </Box>
        </Box>
      </PageContainer>
    </motion.div>
  );
};

export const EarnPage = () => (
  <DetailsContextProvider>
    <EarnPageComponent />
  </DetailsContextProvider>
);
