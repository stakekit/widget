import { useTranslation } from "react-i18next";
import { ShellNotice, ShellNoticeFrame } from "../shell-notice";

const testId = "widget-unavailable";

export const WidgetUnavailable = () => {
  const { t } = useTranslation();

  return (
    <ShellNotice
      testId={testId}
      title={t("help_modals.widget_unavailable.title")}
      description={t("help_modals.widget_unavailable.description")}
    />
  );
};

/**
 * The same notice when no Widget Configuration exists (the initial Host
 * Configuration was rejected); the enclosing app container sets its Layout.
 */
export const WidgetUnavailableWithoutConfiguration = () => {
  const { t } = useTranslation();

  return (
    <ShellNoticeFrame
      testId={testId}
      title={t("help_modals.widget_unavailable.title")}
      description={t("help_modals.widget_unavailable.description")}
    />
  );
};
