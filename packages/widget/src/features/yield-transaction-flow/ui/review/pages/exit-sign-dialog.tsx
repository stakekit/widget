import { useTranslation } from "react-i18next";

import { Button, Modal, Spot, Stack } from "../../../../../ui/index";

/** Asks to sign a message proving address ownership before an exit. */
export const ExitSignDialog = ({
  onCancel,
  onContinue,
  open,
}: {
  readonly open: boolean;
  readonly onCancel: () => void;
  readonly onContinue: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={t("position_details.unstake_sign.title")}
      description={t("position_details.unstake_sign.description")}
      closeLabel={t("shared.close")}
      footer={
        <Button variant="primary" size="cta" onClick={onContinue}>
          {t("shared.continue")}
        </Button>
      }
    >
      <Stack align="center">
        <Spot icon="PenIcon" tone="accent" size="lg" />
      </Stack>
    </Modal>
  );
};
