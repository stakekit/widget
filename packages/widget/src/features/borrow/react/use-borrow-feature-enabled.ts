import { useWidgetConfig } from "../../../app/config/use-widget-config";
import { isBorrowFeatureEnabled } from "../state/availability";

export const useBorrowFeatureEnabled = () =>
  isBorrowFeatureEnabled({
    borrowEnabled: useWidgetConfig("borrowEnabled"),
    dashboardVariant: useWidgetConfig("dashboardVariant"),
    yieldGrouping: useWidgetConfig("yieldGrouping"),
  });
