import { useTranslation } from "react-i18next";
import {
  Entrance,
  Notice,
  Skeleton,
  Spinner,
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

const EarnPageSkeleton = () => {
  const { hidesEarnLoadingSpinner } = useWidgetConfig("hostProfile");

  return (
    <PageContainer>
      <Stack gap={8}>
        {!hidesEarnLoadingSpinner && <Spinner />}
        <Skeleton shape="rect" height="panel" />
        <Skeleton shape="rect" height="panel" />
        <Skeleton shape="line" />
      </Stack>

      <Skeleton shape="rect" height="section" />

      <EarnPageCtaButton cta={loadingCta} />
    </PageContainer>
  );
};

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
