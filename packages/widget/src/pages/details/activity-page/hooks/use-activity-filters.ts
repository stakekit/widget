import { useState } from "react";
import {
  type ActivityFilter,
  type ActivityFilterCategory,
  activityFilterCategories,
  getActivityFilterCategory,
} from "../activity-filters";
import type { ActionYieldDto } from "../types";

export type ActivityFilterOption = {
  filter: ActivityFilter;
  count: number;
};

type UseActivityFiltersResult = {
  selectedFilter: ActivityFilter;
  setSelectedFilter: (filter: ActivityFilter) => void;
  options: ActivityFilterOption[];
  filteredData: ActionYieldDto[] | undefined;
  filteredCount: number;
};

export const useActivityFilters = (
  data: ActionYieldDto[] | undefined
): UseActivityFiltersResult => {
  const [selectedFilter, setSelectedFilter] = useState<ActivityFilter>("all");

  const categoryByAction = new Map<
    ActionYieldDto,
    ActivityFilterCategory | null
  >();
  data?.forEach((item) =>
    categoryByAction.set(item, getActivityFilterCategory(item))
  );

  const counts = new Map<ActivityFilterCategory, number>();
  categoryByAction.forEach((category) => {
    if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
  });

  const totalCount = data?.length ?? 0;

  const categoryOptions = activityFilterCategories
    .filter((category) => (counts.get(category) ?? 0) > 0)
    .map((category) => ({
      filter: category,
      count: counts.get(category) ?? 0,
    }));

  const options: ActivityFilterOption[] =
    categoryOptions.length > 0
      ? [{ filter: "all", count: totalCount }, ...categoryOptions]
      : [];

  const isSelectedAvailable =
    selectedFilter === "all" ||
    options.some((option) => option.filter === selectedFilter);

  const effectiveFilter: ActivityFilter = isSelectedAvailable
    ? selectedFilter
    : "all";

  const filteredData =
    !data || effectiveFilter === "all"
      ? data
      : data.filter((item) => categoryByAction.get(item) === effectiveFilter);

  return {
    selectedFilter: effectiveFilter,
    setSelectedFilter,
    options,
    filteredData,
    filteredCount: filteredData?.length ?? 0,
  };
};
