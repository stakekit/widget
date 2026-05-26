import type { ExtendedYieldType, Yield } from "../../../domain/types/yields";

export type SelectedStakeData = {
  all: Yield[];
  filtered: Yield[];
  groupsWithCounts: Map<
    ExtendedYieldType,
    {
      itemsLength: number;
      title: string;
    }
  >;
};
