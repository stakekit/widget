import { useTranslation } from "react-i18next";
import { ShellNotice } from "../shell-notice";

export const NoEnabledYields = () => {
  const { t } = useTranslation();

  return (
    <ShellNotice
      testId="no-enabled-yields"
      title={t("help_modals.no_enabled_yields.title")}
      description={t("help_modals.no_enabled_yields.description")}
    />
  );
};
