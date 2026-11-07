import { useTranslation } from "react-i18next";

import { EmbeddedPage, Modal } from "../../../../../ui/index";

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

  return (
    <Modal
      open={isOpen}
      onOpenChange={onOpenChange}
      size="page"
      title={t("details.kyc_gate.modal.title")}
      closeLabel={t("details.kyc_gate.modal.close")}
      testId="kyc-verification-modal"
      closeTestId="kyc-verification-close"
    >
      <EmbeddedPage
        src={url}
        title={t("details.kyc_gate.modal.iframe_title")}
        testId="kyc-verification-iframe"
      />
    </Modal>
  );
};
