import { useWidgetConfig } from "../../../../../features/widget-configuration/index";
import { Divider, Stack } from "../../../../../ui/index";
import { useEarnPageStatus } from "../../../react/use-earn-facades";
import { EarnKycGate } from "../../components/earn-kyc-gate";
import { EarnLoadFailed } from "../../components/earn-load-failed";
import { EarnPageCta } from "../../components/earn-page-cta";
import { ExtraArgsSelection } from "../../components/extra-args-selection";
import { Footer } from "../../components/footer";
import { SelectTokenSection } from "../../components/select-token-section";
import { SelectYieldSection } from "../../components/select-yield-section";

/** The Dashboard Layout's Earn form, beside its details. */
export const EarnPageContent = ({
  registerFooterButton = true,
}: {
  readonly registerFooterButton?: boolean;
}) => {
  const { earnPresentation } = useWidgetConfig("hostProfile");
  const { view: status } = useEarnPageStatus();

  if (status.isError) {
    return (
      <Stack gap={16} grow>
        <EarnLoadFailed />
      </Stack>
    );
  }

  return (
    <Stack gap={16} grow>
      <Stack gap={12}>
        <SelectTokenSection />

        <SelectYieldSection alwaysShowStrategy showRiskSummary={false} />

        <EarnKycGate />

        <ExtraArgsSelection showDivider={false} />
      </Stack>

      {earnPresentation.condensed && <Divider />}

      <Footer />

      <EarnPageCta enabled={registerFooterButton} />
    </Stack>
  );
};
