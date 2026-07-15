import { useAtom } from "@effect/atom-react";
import type { ActivityFilter, ActivityFilterOption } from "../model/filters";
import { activityFilterAtom } from "../state/filter";

export const useActivityFilter = (
  options: ReadonlyArray<ActivityFilterOption>
) => {
  const [selectedFilter, setSelectedFilter] = useAtom(activityFilterAtom);
  const isSelectedAvailable =
    selectedFilter === "all" ||
    options.some((option) => option.filter === selectedFilter);

  return {
    selectedFilter: isSelectedAvailable ? selectedFilter : "all",
    setSelectedFilter,
  } satisfies {
    readonly selectedFilter: ActivityFilter;
    readonly setSelectedFilter: (filter: ActivityFilter) => void;
  };
};
