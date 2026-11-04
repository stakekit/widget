import { useTranslation } from "react-i18next";
import {
  type WidgetPath,
  widgetRoutes,
} from "../../../../../../services/navigation/widget-routes";
import { Box, type TabOption, Tabs } from "../../../../../../ui/index";
import {
  useWidgetNavigate,
  useWidgetRoutePrefixMatch,
} from "../../../../../navigation/index";
import { useTrackEvent } from "../../../../../tracking/index";

type DetailsTab = "earn" | "positions" | "activity";

const tabPaths: Record<DetailsTab, WidgetPath> = {
  earn: widgetRoutes.earn.build(),
  positions: widgetRoutes.positions.build(),
  activity: widgetRoutes.activity.build(),
};

/** The Compact Layout's tabs: Earn, Manage and Activity. */
export const DetailsTabs = ({
  pendingActionsCount,
}: {
  readonly pendingActionsCount: number;
}) => {
  const { t } = useTranslation();
  const trackEvent = useTrackEvent();
  const navigation = useWidgetNavigate();
  const positionsMatch = useWidgetRoutePrefixMatch(widgetRoutes.positions);
  const activityMatch = useWidgetRoutePrefixMatch(widgetRoutes.activity);
  const selectedTab = ((): DetailsTab => {
    if (positionsMatch) return "positions";
    if (activityMatch) return "activity";
    return "earn";
  })();

  const tabs: ReadonlyArray<TabOption<DetailsTab>> = [
    { value: "earn", label: t("details.tabs.earn") },
    {
      value: "positions",
      label: t("details.tabs.positions"),
      count: pendingActionsCount,
    },
    { value: "activity", label: t("details.tabs.activity") },
  ];

  return (
    <Box hostHook="tabs-section">
      <Tabs
        tabs={tabs}
        value={selectedTab}
        label={t("shared.widget_sections")}
        onValueChange={(selected) => {
          trackEvent("tabClicked", { selected });
          void navigation.push(tabPaths[selected]);
        }}
      />
    </Box>
  );
};
