import type { MotionProps, TargetAndTransition } from "motion/react";
import { motion } from "motion/react";
import { Just } from "purify-ts";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { Text } from "../../../components/atoms/typography/text";
import { ZerionChainModal } from "../../../components/molecules/zerion-chain-modal";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useMountAnimation } from "../../../providers/mount-animation";
import { useSettings } from "../../../providers/settings";
import { PageContainer } from "../../components/page-container";
import { ExtraArgsSelection } from "./components/extra-args-selection";
import { Footer } from "./components/footer";
import { SelectTokenSection } from "./components/select-token-section";
import { SelectTokenTitle } from "./components/select-token-section/title";
import { SelectValidatorSection } from "./components/select-validator-section";
import { SelectYieldSection } from "./components/select-yield-section";
import { StakedVia } from "./components/select-yield-section/staked-via";
import {
  EarnPageContextProvider,
  useEarnPageContext,
} from "./state/earn-page-context";
import { EarnPageStateUsageBoundaryProvider } from "./state/earn-page-state-context";

const EarnPageComponent = () => {
  useTrackPage("earn");

  const { t } = useTranslation();

  const { variant } = useSettings();

  const { isError } = useEarnPageContext();

  return (
    <PageContainer>
      <Box>
        {variant !== "zerion" && <SelectTokenTitle />}

        <ZerionChainModal />

        <SelectTokenSection />

        <SelectYieldSection />

        <StakedVia />

        <SelectValidatorSection />

        <ExtraArgsSelection />
      </Box>

      {isError && (
        <Box display="flex" alignItems="center" justifyContent="center" my="4">
          <Text variant={{ type: "danger" }} textAlign="center">
            {t("shared.something_went_wrong")}
          </Text>
        </Box>
      )}

      <Box marginTop="4">
        <Footer />
      </Box>
    </PageContainer>
  );
};

export const EarnPage = () => (
  <EarnPageStateUsageBoundaryProvider>
    <EarnPageContextProvider>
      <EarnPageComponent />
    </EarnPageContextProvider>
  </EarnPageStateUsageBoundaryProvider>
);

export const AnimatedEarnPage = () => {
  const { mountAnimationFinished, dispatch } = useMountAnimation();
  const { disableInitLayoutAnimation } = useSettings();

  const { animate, initial } = Just({
    opacity: 1,
    translateY: 0,
  })
    .chain<{ animate: TargetAndTransition; initial: MotionProps["initial"] }>(
      (animateTo) =>
        Just(null)
          .map<{
            transition: MotionProps["transition"];
            initial: MotionProps["initial"];
          }>(() => {
            if (mountAnimationFinished) {
              return {
                transition: { duration: 0.3, delay: 0 },
                initial: { opacity: 0, translateY: "-10px" },
              };
            }
            if (disableInitLayoutAnimation) {
              return {
                transition: { duration: 0 },
                initial: { opacity: 1, translateY: 0 },
              };
            }

            return {
              transition: { duration: 1, delay: 0.8 },
              initial: { opacity: 0, translateY: "-40px" },
            };
          })
          .map((val) => ({
            animate: { ...animateTo, transition: val.transition },
            initial: val.initial,
          }))
    )
    .unsafeCoerce();

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
