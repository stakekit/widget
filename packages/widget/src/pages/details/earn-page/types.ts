import type {
  ExtendedYieldType,
  YieldBase,
} from "../../../domain/types/yields";

export type SelectedStakeData = {
  all: YieldBase[];
  filtered: YieldBase[];
  groupsWithCounts: Map<
    ExtendedYieldType,
    {
      itemsLength: number;
      title: string;
    }
  >;
};
