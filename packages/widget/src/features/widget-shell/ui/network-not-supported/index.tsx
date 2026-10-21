import { useTranslation } from "react-i18next";
import { ShellNotice } from "../shell-notice";

export const NetworkNotSupported = () => {
  const { t } = useTranslation();

  return (
    <ShellNotice
      testId="network-not-supported"
      title={t("help_modals.network_not_supported.title")}
      description={t("help_modals.network_not_supported.description")}
    />
  );
};
