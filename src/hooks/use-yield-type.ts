import type { YieldDto } from "@stakekit/api-hooks";
import type { Maybe } from "purify-ts";
import { yieldTypesMap } from "../domain/types";

export const useYieldType = (yieldOpportunity: Maybe<YieldDto>) => {
  return yieldOpportunity.chainNullable((s) => yieldTypesMap[s.metadata.type]);
};
