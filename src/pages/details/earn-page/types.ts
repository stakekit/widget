import { YieldDto, YieldType } from "@stakekit/api-hooks";

export type SelectedStakeData = {
  all: YieldDto[];
  filtered: YieldDto[];
  groupsWithCounts: Map<
    YieldType,
    {
      itemsLength: number;
      title: string;
    }
  >;
};
