import type { SettingsProps, VariantProps } from "../../public-api/types";

export type { SettingsProps, VariantProps } from "../../public-api/types";

type ResolvedSettingsProps = Omit<
  SettingsProps,
  "borrowEnabled" | "dashboardYieldCategoryOrder" | "yieldGrouping"
> & {
  borrowEnabled: boolean;
  dashboardYieldCategoryOrder: NonNullable<
    SettingsProps["dashboardYieldCategoryOrder"]
  >;
  yieldGrouping: NonNullable<SettingsProps["yieldGrouping"]>;
};

export type SettingsContextType = ResolvedSettingsProps & VariantProps;
