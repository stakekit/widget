import type { useActivityActions } from "../../../../hooks/api/use-activity-actions";
import type { ActivityFilter } from "../activity-filters";
import type { ActivityFilterOption } from "../hooks/use-activity-filters";
import type { ActionYieldDto } from "../types";

export type ActivityPageContextType = {
  onActionSelect: (val: ActionYieldDto) => void;
  activityActions: ReturnType<typeof useActivityActions>;
  filterOptions: ActivityFilterOption[];
  selectedFilter: ActivityFilter;
  setSelectedFilter: (filter: ActivityFilter) => void;
};
