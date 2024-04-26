import { Text } from "../../../components/atoms/typography";
import { Box } from "../../../components/atoms/box";
import { PageContainer } from "../../components";
import { Footer } from "./components/footer";
import { SelectValidatorSection } from "./components/select-validator-section";
import { SelectTokenSection } from "./components/select-token-section";
import { SelectYieldSection } from "./components/select-yield-section";
import {
  DetailsContextProvider,
  useDetailsContext,
} from "./state/details-context";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { ExtraArgsSelection } from "./components/extra-args-selection";
import type { MotionProps, TargetAndTransition } from "framer-motion";
import { motion } from "framer-motion";
import { ReferralCode } from "./components/referral-code";
import { useMountAnimation } from "../../../providers/mount-animation";
import { useTranslation } from "react-i18next";
import { useSettings } from "../../../providers/settings";
import { SelectTokenTitle } from "./components/select-token-section/title";
import { ZerionChainModal } from "../../../components/molecules/zerion-chain-modal";
import { StakedVia } from "./components/select-yield-section/staked-via";
import { Just } from "purify-ts";

const EarnPageComponent = () => {
  useTrackPage("earn");

  const { t } = useTranslation();

  const { variant } = useSettings();

  const { referralCheck, isError } = useDetailsContext();

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
            } else if (disableInitLayoutAnimation) {
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
      <PageContainer>
        <Box>
          {variant === "default" && <SelectTokenTitle />}

          <ZerionChainModal />

          <SelectTokenSection />

          <SelectYieldSection />

          <StakedVia />

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
              {t("shared.something_went_wrong")}
            </Text>
          </Box>
        )}

        <Box marginTop="4">
          <Footer />
        </Box>

        {referralCheck && (
          <Box marginTop="4">
            <ReferralCode />
          </Box>
        )}
      </PageContainer>
    </motion.div>
  );
};

export const EarnPage = () => (
  <DetailsContextProvider>
    <EarnPageComponent />
  </DetailsContextProvider>
);
