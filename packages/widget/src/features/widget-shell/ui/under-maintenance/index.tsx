import { useAtomSet } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import { refreshWidgetHealthAtom } from "../../../../resources/widget-health/index";
import { ShellNotice } from "../shell-notice";

/**
 * Widget Maintenance: the whole Widget says the service is down for now. It
 * checks again on its own; "Try again" checks now.
 */
const UnderMaintenance = () => {
  const { t } = useTranslation();
  const refreshHealth = useAtomSet(refreshWidgetHealthAtom);

  return (
    <ShellNotice
      testId="under-maintenance"
      icon="WrenchIcon"
      title={t("help_modals.under_maintenance.title")}
      description={t("help_modals.under_maintenance.description")}
      action={{
        label: t("shared.retry"),
        onClick: () => refreshHealth(undefined),
      }}
    />
  );
};

export default UnderMaintenance;
