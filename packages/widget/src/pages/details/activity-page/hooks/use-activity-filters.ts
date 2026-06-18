import { useState } from "react";
import type { ActivityFilter } from "../activity-filters";

export type ActivityFilterOption = {
  filter: ActivityFilter;
  count: number;
};

type UseActivityFiltersResult = {
  selectedFilter: ActivityFilter;
  setSelectedFilter: (filter: ActivityFilter) => void;
};

export const useActivityFilters = ({
  options,
}: {
  options: ActivityFilterOption[];
}): UseActivityFiltersResult => {
  const [selectedFilter, setSelectedFilter] = useState<ActivityFilter>("all");

  const isSelectedAvailable =
    selectedFilter === "all" ||
    options.some((option) => option.filter === selectedFilter);

  const effectiveFilter: ActivityFilter = isSelectedAvailable
    ? selectedFilter
    : "all";

  return {
    selectedFilter: effectiveFilter,
    setSelectedFilter,
  };
};
