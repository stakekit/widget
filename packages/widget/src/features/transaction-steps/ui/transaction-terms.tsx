import { Trans, useTranslation } from "react-i18next";
import { ExternalLink, Text } from "../../../ui/index";
import { useTrackEvent } from "../../tracking/index";

const termsOfUseUrl = "https://docs.yield.xyz/docs/terms-of-use";
// The Terms of Use's own section on the risks of what the user confirms.
const riskDisclosuresUrl = `${termsOfUseUrl}#6-high-risk-investment-warning-and-risk-disclosures`;

/**
 * The legal line over a Review's confirm button, naming that button as it
 * reads, such as "Confirm anyway", with links to the Terms of Use and the
 * Risk Disclosures.
 */
export const TransactionTerms = ({ action }: { readonly action: string }) => {
  const { t } = useTranslation();
  const trackEvent = useTrackEvent();
  const newTabLabel = t("shared.opens_in_new_tab");

  return (
    <Text as="p" variant="caption" tone="muted">
      <Trans
        i18nKey="review.terms_of_use"
        values={{ action }}
        components={{
          underline0: (
            <ExternalLink
              href={termsOfUseUrl}
              newTabLabel={newTabLabel}
              onClick={() => trackEvent("termsClicked")}
            >
              {null}
            </ExternalLink>
          ),
          underline1: (
            <ExternalLink href={riskDisclosuresUrl} newTabLabel={newTabLabel}>
              {null}
            </ExternalLink>
          ),
        }}
      />
    </Text>
  );
};
