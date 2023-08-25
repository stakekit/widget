import { YieldOpportunityDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { yieldTypesMap } from "../domain/types";

export const useYieldType = (yieldOpportunity: Maybe<YieldOpportunityDto>) => {
  return yieldOpportunity
    .chainNullable((s) => yieldTypesMap[s.config.type])
    .mapOrDefault((y) => y.title, "");
};
