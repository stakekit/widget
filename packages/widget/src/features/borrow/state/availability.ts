import type { WidgetConfig } from "../../../services/config/widget-config";

export const isBorrowFeatureEnabled = ({
  borrowEnabled,
  dashboardVariant,
  yieldGrouping,
}: Pick<
  WidgetConfig,
  "borrowEnabled" | "dashboardVariant" | "yieldGrouping"
>) => borrowEnabled && !!dashboardVariant && yieldGrouping === "category";
