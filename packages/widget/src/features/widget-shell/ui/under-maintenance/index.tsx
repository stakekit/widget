import { useTranslation } from "react-i18next";
import { images } from "../../../../shared/assets/images";
import { Illustration, Stack, Text } from "../../../../ui/index";
import { ShellFrame } from "../shell-frame";

/** Widget Maintenance: the whole Widget says the service is down for now. */
const UnderMaintenance = () => {
  const { t } = useTranslation();

  return (
    <ShellFrame>
      <Stack testId="under-maintenance" align="center" gap={16}>
        <Illustration src={images.fees} size="lg" />
        <Text variant="title" as="h2" align="center">
          {t("help_modals.under_maintenance.title")}
        </Text>
        <Text as="p" tone="muted" align="center">
          {t("help_modals.under_maintenance.description")}
        </Text>
        <Text as="p" tone="muted" align="center">
          {t("help_modals.under_maintenance.description2")}
        </Text>
      </Stack>
    </ShellFrame>
  );
};

export default UnderMaintenance;
