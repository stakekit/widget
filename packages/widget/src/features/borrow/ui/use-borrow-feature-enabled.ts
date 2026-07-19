import { useWidgetConfig } from "../../../app/config/use-widget-config";
import { isBorrowFeatureEnabled } from "../availability";

export const useBorrowFeatureEnabled = () =>
  isBorrowFeatureEnabled({
    borrowEnabled: useWidgetConfig("borrowEnabled"),
    dashboardVariant: useWidgetConfig("dashboardVariant"),
    yieldGrouping: useWidgetConfig("yieldGrouping"),
  });
