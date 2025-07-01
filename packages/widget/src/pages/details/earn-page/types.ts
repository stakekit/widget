import type { YieldDto } from "@stakekit/api-hooks";
import type { ExtendedYieldType } from "../../../domain/types/yields";

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
