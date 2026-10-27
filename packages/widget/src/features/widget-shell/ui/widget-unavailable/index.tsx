import { useTranslation } from "react-i18next";
import {
  ShellNotice,
  ShellNoticeFrame,
  type ShellNoticeLayout,
} from "../shell-notice";

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
 * Configuration was rejected), laid out from the given host layout.
 */
export const WidgetUnavailableWithoutConfiguration = ({
  layout,
}: {
  readonly layout: ShellNoticeLayout;
}) => {
  const { t } = useTranslation();

  return (
    <ShellNoticeFrame
      layout={layout}
      testId={testId}
      title={t("help_modals.widget_unavailable.title")}
      description={t("help_modals.widget_unavailable.description")}
    />
  );
};
