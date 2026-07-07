import type { ActionDto } from "../../../domain/types/action";
import type { Validator } from "../../../domain/types/validators";
import type { Yield } from "../../../domain/types/yields";

export type ActionYieldDto = {
  actionData: ActionDto;
  yieldData: Yield | null;
  validatorsData: Validator[];
};
