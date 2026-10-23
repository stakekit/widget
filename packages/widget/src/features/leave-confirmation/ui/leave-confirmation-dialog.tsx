import { useTranslation } from "react-i18next";
import { SelectModal } from "../../../shared/ui/components/select-modal";
import { Box } from "../../../shared/ui/primitives/box";
import { Button } from "../../../shared/ui/primitives/button";
import { Heading } from "../../../shared/ui/primitives/typography/heading";
import { Text } from "../../../shared/ui/primitives/typography/text";
import { useWidgetConfig } from "../../widget-configuration/index";
import type { LeaveConfirmationDialogProps } from "../react/use-leave-confirmation";

/** Mounted only while asking, so the controls that host it stay light. */
export const LeaveConfirmationDialog = (props: LeaveConfirmationDialogProps) =>
  props.open ? <OpenLeaveConfirmationDialog {...props} /> : null;

const OpenLeaveConfirmationDialog = ({
  onLeave,
  onStay,
}: LeaveConfirmationDialogProps) => {
  const { t } = useTranslation();
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const size = dashboardVariant ? "compact" : "regular";

  return (
    <SelectModal
      dialogTitle={t("leave_confirmation.title")}
      state={{
        isOpen: true,
        setOpen: (isOpen) => {
          if (!isOpen) onStay();
        },
      }}
    >
      <Box
        data-testid="leave-confirmation"
        display="flex"
        flexDirection="column"
        alignItems="center"
        gap="2"
        px="6"
        paddingBottom="6"
      >
        <Heading variant={{ level: "h4" }}>
          {t("leave_confirmation.title")}
        </Heading>

        <Text variant={{ type: "muted", weight: "normal" }} textAlign="center">
          {t("leave_confirmation.description")}
        </Text>

        <Box
          display="flex"
          flexDirection="column"
          gap="2"
          marginTop="6"
          width="full"
        >
          <Button onClick={onStay} variant={{ size }}>
            {t("leave_confirmation.stay")}
          </Button>
          <Button onClick={onLeave} variant={{ color: "secondary", size }}>
            {t("leave_confirmation.leave")}
          </Button>
        </Box>
      </Box>
    </SelectModal>
  );
};
