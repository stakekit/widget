import type { ExtendedYieldType } from "@sk-widget/domain/types";
import type { YieldDto } from "@stakekit/api-hooks";

export type SelectedStakeData = {
  all: YieldDto[];
  filtered: YieldDto[];
  groupsWithCounts: Map<
    ExtendedYieldType,
    {
      itemsLength: number;
      title: string;
    }
  >;
};
