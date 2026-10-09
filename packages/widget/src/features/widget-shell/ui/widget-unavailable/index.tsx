import { useTranslation } from "react-i18next";
import { ShellNotice } from "../shell-notice";

export const WidgetUnavailable = () => {
  const { t } = useTranslation();

  return (
    <ShellNotice
      testId="widget-unavailable"
      title={t("help_modals.widget_unavailable.title")}
      description={t("help_modals.widget_unavailable.description")}
    />
  );
};
