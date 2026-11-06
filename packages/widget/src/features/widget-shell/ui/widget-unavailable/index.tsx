import { useTranslation } from "react-i18next";

import { ShellNotice } from "../shell-notice";

/**
 * The notice shown when the Widget cannot load, also when no Widget
 * Configuration exists (the initial Host Configuration was rejected). With
 * `onRetry`, when rendering again may succeed, it offers "Try again".
 */
export const WidgetUnavailable = ({
  onRetry,
}: {
  readonly onRetry?: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <ShellNotice
      testId="widget-unavailable"
      failure
      icon="WarningIcon"
      title={t("help_modals.widget_unavailable.title")}
      description={t("help_modals.widget_unavailable.description")}
      {...(onRetry === undefined
        ? {}
        : { action: { label: t("shared.retry"), onClick: onRetry } })}
    />
  );
};
