import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../features/widget-configuration/index";
import { Divider, Notice, Stack } from "../../../../../ui/index";
import { useEarnPageStatus } from "../../../react/use-earn-facades";
import { EarnKycGate } from "../../components/earn-kyc-gate";
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
  const { t } = useTranslation();
  const { earnPresentation } = useWidgetConfig("hostProfile");
  const { view: status } = useEarnPageStatus();

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

      {status.isError && (
        <Notice tone="danger">{t("shared.something_went_wrong")}</Notice>
      )}

      <EarnPageCta enabled={registerFooterButton} />
    </Stack>
  );
};
