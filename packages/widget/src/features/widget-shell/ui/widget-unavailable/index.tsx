import { useTranslation } from "react-i18next";
import { ShellNotice } from "../shell-notice";

/**
 * The notice shown when the Widget cannot load, also when no Widget
 * Configuration exists (the initial Host Configuration was rejected).
 */
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
