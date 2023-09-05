import { YieldDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { yieldTypesMap } from "../domain/types";

export const useYieldType = (yieldOpportunity: Maybe<YieldDto>) => {
  return yieldOpportunity
    .chainNullable((s) => yieldTypesMap[s.metadata.type])
    .mapOrDefault((y) => y.title, "");
};
