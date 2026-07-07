import { useSettings } from "../../providers/settings";
import type { SettingsContextType } from "../../providers/settings/types";

export const isBorrowFeatureEnabled = ({
  borrowEnabled,
  dashboardVariant,
  yieldGrouping,
}: Pick<
  SettingsContextType,
  "borrowEnabled" | "dashboardVariant" | "yieldGrouping"
>) => borrowEnabled && !!dashboardVariant && yieldGrouping === "category";

export const useBorrowFeatureEnabled = () =>
  isBorrowFeatureEnabled(useSettings());
