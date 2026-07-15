import type { YieldAction } from "../../../../../domain/schema/action-models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../../domain/schema/earn-models";

export type ActionYieldDto = {
  actionData: YieldAction;
  yieldData: EarnYieldWithProvider | null;
  validatorsData: EarnValidator[];
};
