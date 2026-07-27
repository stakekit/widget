import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../app/config/use-widget-config";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Button } from "../../../../../shared/ui/primitives/button";
import { ContentLoaderSquare } from "../../../../../shared/ui/primitives/content-loader";
import { Spinner } from "../../../../../shared/ui/primitives/spinner";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useMountAnimation } from "../../../../mount-animation/state";
import { useTrackPage } from "../../../../tracking/state";
import { ZerionChainModal } from "../../../../wallet/ui";
import {
  PageContainer,
  type PageCta,
  PageCtaButton,
} from "../../../../widget-shell/components";
import { useEarnPageStatus } from "../../../react/use-earn-facades";
import { EarnKycGate } from "../../components/earn-kyc-gate";
import { EarnPageCta } from "../../components/earn-page-cta";
import { ExtraArgsSelection } from "./components/extra-args-selection";
import { Footer } from "./components/footer";
import { SelectProvider } from "./components/select-provider";
import { SelectTokenSection } from "./components/select-token-section";
import { SelectTokenTitle } from "./components/select-token-section/title";
import { SelectValidatorSection } from "./components/select-validator-section";
import { SelectYieldSection } from "./components/select-yield-section";

const hiddenLivePresentationStyle = {
  inset: 0,
  pointerEvents: "none",
  position: "absolute",
  visibility: "hidden",
  width: "100%",
} satisfies CSSProperties;

const loadingCta = {
  disabled: true,
  isLoading: true,
  label: "",
  onClick: () => undefined,
} satisfies PageCta;

const EarnPageSkeleton = () => {
  const variant = useWidgetConfig("variant");

  return (
    <PageContainer aria-hidden="true" data-rk="earn-mount-skeleton" inert>
      <Box>
        {variant !== "zerion" && (
          <Box display="flex" alignItems="center" my="1">
            <Spinner />
          </Box>
        )}

        <Box marginTop="2">
          <ContentLoaderSquare heightPx={112.5} />
        </Box>

        <Box marginTop="2">
          <ContentLoaderSquare heightPx={112.5} />
        </Box>

        <Box marginTop="2">
          <ContentLoaderSquare heightPx={20} variant={{ size: "medium" }} />
        </Box>
      </Box>

      <Box marginTop="4">
        <ContentLoaderSquare heightPx={150} />
      </Box>

      <PageCtaButton cta={loadingCta} />
    </PageContainer>
  );
};

const EarnPageComponent = () => {
  useTrackPage("earn");

  const { t } = useTranslation();

  const variant = useWidgetConfig("variant");

  const { retry, view: status } = useEarnPageStatus();

  return (
    <Box position="relative">
      {status.presentationFrozen && <EarnPageSkeleton />}

      <Box
        aria-hidden={status.presentationFrozen || undefined}
        data-rk="earn-live-presentation"
        inert={status.presentationFrozen || undefined}
        style={
          status.presentationFrozen ? hiddenLivePresentationStyle : undefined
        }
      >
        <PageContainer>
          <Box>
            {variant !== "zerion" && <SelectTokenTitle />}

            <ZerionChainModal />

            <SelectTokenSection />

            <SelectYieldSection />

            <EarnKycGate />

            <SelectProvider />

            <SelectValidatorSection />

            <ExtraArgsSelection />
          </Box>

          {status.isError && (
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
              {status.canRetry && (
                <Button data-rk="earn-retry" onClick={() => retry(undefined)}>
                  {t("shared.retry")}
                </Button>
              )}
            </Box>
          )}

          <Box marginTop="4">
            <Footer />
          </Box>

          <EarnPageCta />
        </PageContainer>
      </Box>
    </Box>
  );
};

const EarnPage = () => <EarnPageComponent />;

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
