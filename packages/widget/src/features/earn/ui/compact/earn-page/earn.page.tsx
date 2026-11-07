import { Entrance, Stack, StandIn } from "../../../../../ui/index";
import { useMountAnimation } from "../../../../mount-animation/index";
import { useTrackPage } from "../../../../tracking/index";
import { ZerionChainModal } from "../../../../wallet/views";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import { PageContainer, PageCtaButton } from "../../../../widget-shell/views";
import { useEarnPageStatus } from "../../../react/use-earn-facades";
import {
  AmountPanelSkeleton,
  EarnCardSkeleton,
} from "../../components/earn-form-skeleton";
import { EarnKycGate } from "../../components/earn-kyc-gate";
import { EarnLoadFailed } from "../../components/earn-load-failed";
import { EarnPageCta, earnLoadingCta } from "../../components/earn-page-cta";
import { ExtraArgsSelection } from "../../components/extra-args-selection";
import { Footer } from "../../components/footer";
import { SelectTokenSection } from "../../components/select-token-section";
import { SelectYieldSection } from "../../components/select-yield-section";
import { SelectProvider } from "./components/select-provider";
import { SelectValidatorSection } from "./components/select-validator-section";

/**
 * Stands in for the form while it settles, shaped like it: the amount, the
 * Earn card, and the CTA's neutral stand-in.
 */
const EarnPageSkeleton = () => (
  <PageContainer>
    <Stack gap={12}>
      <AmountPanelSkeleton />
      <EarnCardSkeleton />
    </Stack>

    <PageCtaButton cta={earnLoadingCta} />
  </PageContainer>
);

const EarnPage = () => {
  useTrackPage("earn");

  const { view: status } = useEarnPageStatus();

  return (
    <StandIn
      show={status.presentationFrozen}
      standIn={<EarnPageSkeleton />}
      testIds={{
        standIn: "earn-mount-skeleton",
        content: "earn-live-presentation",
      }}
    >
      <PageContainer>
        {status.isError ? (
          <EarnLoadFailed />
        ) : (
          <>
            <Stack gap={12}>
              <ZerionChainModal />

              <SelectTokenSection />

              <SelectYieldSection alwaysShowStrategy={false} showRiskSummary />

              <EarnKycGate />

              <SelectProvider />

              <SelectValidatorSection />

              <ExtraArgsSelection showDivider />
            </Stack>

            <Footer />

            <EarnPageCta />
          </>
        )}
      </PageContainer>
    </StandIn>
  );
};

/** The Compact Layout's Earn page, dropping in as the Widget mounts. */
export const AnimatedEarnPage = () => {
  const { mountAnimationFinished, dispatch } = useMountAnimation();
  const disableInitLayoutAnimation = useWidgetConfig(
    "disableInitLayoutAnimation"
  );
  const getStage = () => {
    if (mountAnimationFinished) return "later";
    if (disableInitLayoutAnimation) return "still";
    return "first";
  };

  return (
    <Entrance
      stage={getStage()}
      onEntered={() => {
        if (!mountAnimationFinished) dispatch({ type: "earnPage" });
      }}
    >
      <EarnPage />
    </Entrance>
  );
};
