import type { ActionDto, YieldDto } from "@stakekit/api-hooks";

export type ActionYieldDto = {
  actionData: ActionDto;
  yieldData: YieldDto;
};
