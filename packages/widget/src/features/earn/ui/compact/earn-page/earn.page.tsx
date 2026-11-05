import { useTranslation } from "react-i18next";
import {
  Entrance,
  Notice,
  Skeleton,
  Stack,
  StandIn,
} from "../../../../../ui/index";
import { useMountAnimation } from "../../../../mount-animation/index";
import { useTrackPage } from "../../../../tracking/index";
import { ZerionChainModal } from "../../../../wallet/views";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import { PageContainer, type PageCta } from "../../../../widget-shell/views";
import { useEarnPageStatus } from "../../../react/use-earn-facades";
import { EarnKycGate } from "../../components/earn-kyc-gate";
import { EarnPageCta, EarnPageCtaButton } from "../../components/earn-page-cta";
import { ExtraArgsSelection } from "../../components/extra-args-selection";
import { Footer } from "../../components/footer";
import { SelectTokenSection } from "../../components/select-token-section";
import { SelectYieldSection } from "../../components/select-yield-section";
import { SelectProvider } from "./components/select-provider";
import { SelectValidatorSection } from "./components/select-validator-section";

const loadingCta = {
  disabled: true,
  isLoading: true,
  label: "",
  onClick: () => undefined,
} satisfies PageCta;

/** Stands in for the form while it settles: its cards, notes and CTA. */
const EarnPageSkeleton = () => (
  <PageContainer>
    <Stack gap={8}>
      <Skeleton shape="rect" height="section" />
      <Skeleton shape="rect" height="section" />
      <Skeleton shape="rect" height="panel" />
    </Stack>

    <Stack gap={8}>
      <Skeleton shape="line" />
      <Skeleton shape="line" width="threeQuarters" />
      <Skeleton shape="line" width="half" />
    </Stack>

    <EarnPageCtaButton cta={loadingCta} />
  </PageContainer>
);

const EarnPage = () => {
  useTrackPage("earn");

  const { t } = useTranslation();
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
        <Stack gap={12}>
          <ZerionChainModal />

          <SelectTokenSection />

          <SelectYieldSection alwaysShowStrategy={false} showRiskSummary />

          <EarnKycGate />

          <SelectProvider />

          <SelectValidatorSection />

          <ExtraArgsSelection showDivider />
        </Stack>

        {status.isError && (
          <Notice tone="danger">{t("shared.something_went_wrong")}</Notice>
        )}

        <Footer />

        <EarnPageCta />
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
