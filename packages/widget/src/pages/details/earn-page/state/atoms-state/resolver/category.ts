import { DashboardYieldCategory } from "../../../../../../domain/types/yields";

export const resolveCategory = ({
  availableCategories,
  categoryOrder,
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

  if (
    selectedCategory &&
    (availableCategories.length === 0 ||
      availableCategories.includes(selectedCategory))
  ) {
    return selectedCategory;
  }

  return (
    availableCategories[0] ?? categoryOrder[0] ?? DashboardYieldCategory.Stake
  );
};
