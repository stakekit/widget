import type { ActionDto } from "../../../domain/types/action";
import type { Yield } from "../../../domain/types/yields";
import type { ValidatorDto } from "../../../generated/api/yield";

export type ActionYieldDto = {
  actionData: ActionDto;
  yieldData: Yield;
  validatorsData: ValidatorDto[];
};
