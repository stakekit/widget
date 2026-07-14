import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import type { ExtendedYieldType } from "../../../domain/types/yields";

export type SelectedStakeData = {
  all: EarnYieldWithProvider[];
  filtered: EarnYieldWithProvider[];
  groupsWithCounts: Map<
    ExtendedYieldType,
    {
      itemsLength: number;
      title: string;
    }
  >;
};
