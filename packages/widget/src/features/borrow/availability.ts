import type { WidgetConfig } from "../../app/config";

export const isBorrowFeatureEnabled = ({
  borrowEnabled,
  dashboardVariant,
  yieldGrouping,
}: Pick<
  WidgetConfig,
  "borrowEnabled" | "dashboardVariant" | "yieldGrouping"
>) => borrowEnabled && !!dashboardVariant && yieldGrouping === "category";
