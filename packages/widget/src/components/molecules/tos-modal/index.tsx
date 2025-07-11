import {
  Close,
  Content,
  Overlay,
  Portal,
  Root,
  Title,
  Trigger,
} from "@radix-ui/react-dialog";
import type { PropsWithChildren, ReactNode } from "react";
import { useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TrackingContext } from "../../../providers/tracking";
import { id } from "../../../styles/theme/ids";
import { SKAnchor } from "../../atoms/anchor";
import { Box } from "../../atoms/box";
import { Button } from "../../atoms/button";
import { XIcon } from "../../atoms/icons/x-icon";
import { Heading } from "../../atoms/typography/heading";
import { Text } from "../../atoms/typography/text";
import {
  closeButton,
  container,
  content,
  contentContainer,
  overlay,
  sectionContainer,
  termsText,
} from "./style.css";

type TosModalProps = {
  customTrigger?: ReactNode;
  onAccept: () => void;
  onDecline: () => void;
  isOpen: boolean;
};

export const TosModal = ({
  customTrigger,
  onAccept,
  onDecline,
  isOpen,
}: TosModalProps) => {
  const { t } = useTranslation();
  const trackEvent = useContext(TrackingContext)?.trackEvent;

  useEffect(() => {
    if (isOpen) {
      trackEvent?.("termsModalOpened");
    }
  }, [isOpen, trackEvent]);

  const handleAccept = () => {
    trackEvent?.("termsModalAccepted");
    onAccept();
  };

  const handleDecline = () => {
    trackEvent?.("termsModalDeclined");
    onDecline();
  };

  return (
    <Root open={isOpen}>
      {customTrigger && <Trigger asChild>{customTrigger}</Trigger>}

      <Portal>
        <Box data-rk={id}>
          <Overlay className={overlay} />
          <Content className={content} aria-describedby={undefined}>
            <Box className={container}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                marginBottom="4"
              >
                <Title asChild>
                  <Heading variant={{ level: "h3" }}>
                    {t("tos_modal.title")}
                  </Heading>
                </Title>
                <Close asChild>
                  <Box
                    as="button"
                    className={closeButton}
                    onClick={handleDecline}
                  >
                    <XIcon />
                  </Box>
                </Close>
              </Box>

              <Box className={contentContainer}>
                <Box className={sectionContainer}>
                  <TermsText>{t("tos_modal.introduction")}</TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <TermsText>{t("tos_modal.additional_terms")}</TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <TermsText>{t("tos_modal.risk_warning")}</TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <TermsText>{t("tos_modal.agreement_binding")}</TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.stakekit_services.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.stakekit_services.content")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.agreement_to_terms.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.agreement_to_terms.content")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.intellectual_property.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.intellectual_property.content_1")}
                  </TermsText>
                  <TermsText>
                    {t("tos_modal.sections.intellectual_property.content_2")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.user_content.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.user_content.content_1")}
                  </TermsText>
                  <TermsText>
                    {t("tos_modal.sections.user_content.content_2")}
                  </TermsText>
                  <TermsText>
                    {t("tos_modal.sections.user_content.content_3")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.acceptable_use.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.acceptable_use.intro")}
                  </TermsText>
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
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.termination.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.termination.content")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.fees.title")}
                  </Heading>
                  <TermsText>{t("tos_modal.sections.fees.content")}</TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.taxes.title")}
                  </Heading>
                  <TermsText>{t("tos_modal.sections.taxes.content")}</TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.confidentiality.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.confidentiality.content_1")}
                  </TermsText>
                  <TermsText>
                    {t("tos_modal.sections.confidentiality.content_2")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.non_disclosure.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.non_disclosure.content_1")}
                  </TermsText>
                  <TermsText>
                    {t("tos_modal.sections.non_disclosure.content_2")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.required_disclosures.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.required_disclosures.content")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.return_confidential.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.return_confidential.content")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.limitation_liability.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.limitation_liability.content_1")}
                  </TermsText>
                  <TermsText>
                    {t("tos_modal.sections.limitation_liability.content_2")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.dispute_resolution.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.dispute_resolution.content_1")}
                  </TermsText>
                  <TermsText>
                    {t("tos_modal.sections.dispute_resolution.content_2")}
                  </TermsText>
                  <TermsText>
                    {t("tos_modal.sections.dispute_resolution.content_3")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.governing_law.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.governing_law.content")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.class_action.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.class_action.content")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.time_limits.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.time_limits.content")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.changes_terms.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.changes_terms.content")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.privacy_policy.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.privacy_policy.content_1")}
                  </TermsText>
                  <TermsText>
                    {t("tos_modal.sections.privacy_policy.content_2")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <Heading variant={{ level: "h4" }}>
                    {t("tos_modal.sections.contact.title")}
                  </Heading>
                  <TermsText>
                    {t("tos_modal.sections.contact.content")}
                  </TermsText>
                </Box>

                <Box className={sectionContainer}>
                  <TermsText>
                    {t("tos_modal.complete_terms_link")}{" "}
                    <SKAnchor href="https://docs.yield.xyz/docs/terms-of-use">
                      https://docs.yield.xyz/docs/terms-of-use
                    </SKAnchor>
                  </TermsText>
                </Box>

                <Box
                  display="flex"
                  gap="3"
                  marginTop="6"
                  flexDirection={{ mobile: "column", tablet: "row" }}
                >
                  <Box flex={1}>
                    <Button
                      variant={{ color: "primary" }}
                      onClick={handleAccept}
                    >
                      <Text variant={{ weight: "bold", type: "inverted" }}>
                        {t("tos_modal.accept_button")}
                      </Text>
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Content>
        </Box>
      </Portal>
    </Root>
  );
};

const TermsText = ({ children }: PropsWithChildren) => {
  return <Text className={termsText}>{children}</Text>;
};
