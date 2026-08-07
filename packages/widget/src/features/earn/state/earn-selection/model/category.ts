import type { DashboardYieldCategory } from "../../../../../public-api/types";

export const resolveCategory = ({
  availableCategories,
  selectedCategory,
  dashboardVariant,
}: {
  availableCategories: ReadonlyArray<DashboardYieldCategory>;
  categoryOrder: ReadonlyArray<DashboardYieldCategory>;
  selectedCategory: DashboardYieldCategory | null;
  dashboardVariant: boolean;
}) => {
  if (!dashboardVariant) {
    return null;
  }

  if (selectedCategory && availableCategories.includes(selectedCategory)) {
    return selectedCategory;
  }

  return availableCategories[0] ?? null;
};
