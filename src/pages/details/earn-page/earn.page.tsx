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
import { motion } from "framer-motion";
import { ReferralCode } from "./components/referral-code";
import { useMountAnimation } from "../../../providers/mount-animation";
import { useTranslation } from "react-i18next";
import { useSettings } from "../../../providers/settings";
import { SelectTokenTitle } from "./components/select-token-section/title";
import { ChainModal } from "../../../components/molecules/chain-modal";

const EarnPageComponent = () => {
  useTrackPage("earn");

  const { t } = useTranslation();

  const { variant } = useSettings();

  const { referralCheck, isError } = useDetailsContext();

  const { mountAnimationFinished, dispatch } = useMountAnimation();

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
      onAnimationComplete={() => dispatch({ type: "earnPage" })}
    >
      <PageContainer>
        <Box>
          {variant === "default" && <SelectTokenTitle />}

          {variant === "zerion" && <ChainModal />}

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
