import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Button, Checkbox, Modal, Stack, Text } from "../../../../ui/index";
import { useTrackEvent } from "../../../tracking/index";
import { TranslatedLink } from "../translated-link";

type TosModalProps = {
  onAccept: () => void;
  onDecline: () => void;
  isOpen: boolean;
};

export const TosModal = ({ onAccept, onDecline, isOpen }: TosModalProps) => {
  const { t } = useTranslation();
  const trackEvent = useTrackEvent();
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      trackEvent("termsModalOpened");
    }
  }, [isOpen, trackEvent]);

  const handleAccept = () => {
    trackEvent("termsModalAccepted");
    onAccept();
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (open) return;
        trackEvent("termsModalDeclined");
        onDecline();
      }}
      title={t("tos_modal.title")}
      closeLabel={t("tos_modal.close")}
      footer={
        <>
          <Checkbox
            checked={agreed}
            onCheckedChange={setAgreed}
            label={t("tos_modal.agree_checkbox")}
          />
          <Button
            variant="primary"
            size="cta"
            disabled={!agreed}
            onClick={handleAccept}
          >
            {t("tos_modal.accept_button")}
          </Button>
        </>
      }
    >
      <Stack gap={16}>
        <TermsText>{t("tos_modal.introduction")}</TermsText>

        <TermsText>{t("tos_modal.additional_terms")}</TermsText>

        <TermsText>{t("tos_modal.risk_warning")}</TermsText>

        <TermsText>{t("tos_modal.agreement_binding")}</TermsText>

        <TermsSection title={t("tos_modal.sections.stakekit_services.title")}>
          <TermsText>
            {t("tos_modal.sections.stakekit_services.content")}
          </TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.agreement_to_terms.title")}>
          <TermsText>
            {t("tos_modal.sections.agreement_to_terms.content")}
          </TermsText>
        </TermsSection>

        <TermsSection
          title={t("tos_modal.sections.intellectual_property.title")}
        >
          <TermsText>
            {t("tos_modal.sections.intellectual_property.content_1")}
          </TermsText>
          <TermsText>
            {t("tos_modal.sections.intellectual_property.content_2")}
          </TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.user_content.title")}>
          <TermsText>
            {t("tos_modal.sections.user_content.content_1")}
          </TermsText>
          <TermsText>
            {t("tos_modal.sections.user_content.content_2")}
          </TermsText>
          <TermsText>
            {t("tos_modal.sections.user_content.content_3")}
          </TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.acceptable_use.title")}>
          <TermsText>{t("tos_modal.sections.acceptable_use.intro")}</TermsText>
          <TermsText>
            {t("tos_modal.sections.acceptable_use.violation_laws")}
          </TermsText>
          <TermsText>
            {t("tos_modal.sections.acceptable_use.harm_minors")}
          </TermsText>
          <TermsText>
            {t("tos_modal.sections.acceptable_use.impersonation")}
          </TermsText>
          <TermsText>
            {t("tos_modal.sections.acceptable_use.restrict_use")}
          </TermsText>
          <TermsText>
            {t("tos_modal.sections.acceptable_use.interfere")}
          </TermsText>
          <TermsText>
            {t("tos_modal.sections.acceptable_use.additional")}
          </TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.termination.title")}>
          <TermsText>{t("tos_modal.sections.termination.content")}</TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.fees.title")}>
          <TermsText>{t("tos_modal.sections.fees.content")}</TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.taxes.title")}>
          <TermsText>{t("tos_modal.sections.taxes.content")}</TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.confidentiality.title")}>
          <TermsText>
            {t("tos_modal.sections.confidentiality.content_1")}
          </TermsText>
          <TermsText>
            {t("tos_modal.sections.confidentiality.content_2")}
          </TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.non_disclosure.title")}>
          <TermsText>
            {t("tos_modal.sections.non_disclosure.content_1")}
          </TermsText>
          <TermsText>
            {t("tos_modal.sections.non_disclosure.content_2")}
          </TermsText>
        </TermsSection>

        <TermsSection
          title={t("tos_modal.sections.required_disclosures.title")}
        >
          <TermsText>
            {t("tos_modal.sections.required_disclosures.content")}
          </TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.return_confidential.title")}>
          <TermsText>
            {t("tos_modal.sections.return_confidential.content")}
          </TermsText>
        </TermsSection>

        <TermsSection
          title={t("tos_modal.sections.limitation_liability.title")}
        >
          <TermsText>
            {t("tos_modal.sections.limitation_liability.content_1")}
          </TermsText>
          <TermsText>
            {t("tos_modal.sections.limitation_liability.content_2")}
          </TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.dispute_resolution.title")}>
          <TermsText>
            {t("tos_modal.sections.dispute_resolution.content_1")}
          </TermsText>
          <TermsText>
            {t("tos_modal.sections.dispute_resolution.content_2")}
          </TermsText>
          <TermsText>
            {t("tos_modal.sections.dispute_resolution.content_3")}
          </TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.governing_law.title")}>
          <TermsText>{t("tos_modal.sections.governing_law.content")}</TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.class_action.title")}>
          <TermsText>{t("tos_modal.sections.class_action.content")}</TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.time_limits.title")}>
          <TermsText>{t("tos_modal.sections.time_limits.content")}</TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.changes_terms.title")}>
          <TermsText>{t("tos_modal.sections.changes_terms.content")}</TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.privacy_policy.title")}>
          <TermsText>
            {t("tos_modal.sections.privacy_policy.content_1")}
          </TermsText>
          <TermsText>
            {t("tos_modal.sections.privacy_policy.content_2")}
          </TermsText>
        </TermsSection>

        <TermsSection title={t("tos_modal.sections.contact.title")}>
          <TermsText>{t("tos_modal.sections.contact.content")}</TermsText>
        </TermsSection>

        <TermsText>
          <Trans
            i18nKey="tos_modal.complete_terms_link"
            components={{ link0: <TranslatedLink /> }}
          />
        </TermsText>
      </Stack>
    </Modal>
  );
};

const TermsSection = ({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) => (
  <Stack gap={8}>
    <Text variant="heading" as="h3">
      {title}
    </Text>
    {children}
  </Stack>
);

const TermsText = ({ children }: { readonly children: ReactNode }) => (
  <Text variant="caption" tone="muted" as="p">
    {children}
  </Text>
);
