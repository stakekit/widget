import { Content, Overlay, Portal, Root, Title } from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../app/composition/use-widget-config";
import { id } from "../../../../../shared/styles/theme/ids";
import { Box } from "../../../../../shared/ui/primitives/box";
import { XIcon } from "../../../../../shared/ui/primitives/icons/x-icon";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import {
  verificationModalCloseStyle,
  verificationModalContainerStyle,
  verificationModalContentStyle,
  verificationModalFrameStyle,
  verificationModalHeaderStyle,
  verificationModalOverlayStyle,
} from "./styles.css";

type KycVerificationModalProps = {
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly url: string;
};

export const KycVerificationModal = ({
  isOpen,
  onOpenChange,
  url,
}: KycVerificationModalProps) => {
  const { t } = useTranslation();
  const portalContainer = useWidgetConfig("portalContainer");

  return (
    <Root open={isOpen} onOpenChange={onOpenChange}>
      <Portal container={portalContainer}>
        <Box
          className={verificationModalContainerStyle}
          data-rk={id}
          data-testid="kyc-verification-modal"
        >
          <Overlay
            onClick={() => onOpenChange(false)}
            className={verificationModalOverlayStyle}
          />

          <Content
            className={verificationModalContentStyle}
            aria-describedby={undefined}
          >
            <Box className={verificationModalHeaderStyle}>
              <Title>
                <Text variant={{ weight: "bold", size: "large" }}>
                  {t("details.kyc_gate.modal.title")}
                </Text>
              </Title>

              <Box
                as="button"
                type="button"
                aria-label={t("details.kyc_gate.modal.close")}
                onClick={() => onOpenChange(false)}
                className={verificationModalCloseStyle}
                data-testid="kyc-verification-close"
              >
                <XIcon />
              </Box>
            </Box>

            <iframe
              className={verificationModalFrameStyle}
              data-testid="kyc-verification-iframe"
              referrerPolicy="strict-origin-when-cross-origin"
              src={url}
              title={t("details.kyc_gate.modal.iframe_title")}
            />
          </Content>
        </Box>
      </Portal>
    </Root>
  );
};
