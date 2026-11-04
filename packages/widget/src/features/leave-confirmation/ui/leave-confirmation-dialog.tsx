import { useTranslation } from "react-i18next";
import { AlertDialog } from "../../../ui/index";
import type { LeaveConfirmationDialogProps } from "../react/use-leave-confirmation";

/** Mounted only while asking, so the controls that host it stay light. */
export const LeaveConfirmationDialog = (props: LeaveConfirmationDialogProps) =>
  props.open ? <OpenLeaveConfirmationDialog {...props} /> : null;

const OpenLeaveConfirmationDialog = ({
  onLeave,
  onStay,
}: LeaveConfirmationDialogProps) => {
  const { t } = useTranslation();

  return (
    <AlertDialog
      open
      testId="leave-confirmation"
      title={t("leave_confirmation.title")}
      description={t("leave_confirmation.description")}
      cancelLabel={t("leave_confirmation.stay")}
      confirmLabel={t("leave_confirmation.leave")}
      tone="danger"
      onCancel={onStay}
      onConfirm={onLeave}
    />
  );
};
