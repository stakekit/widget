import type { YieldDto } from "@stakekit/api-hooks";
import type { Maybe } from "purify-ts";
import { useMemo } from "react";
import { getBaseToken } from "../domain";

export const useBaseToken = (yieldDto: Maybe<YieldDto>) =>
  useMemo(() => yieldDto.map((val) => getBaseToken(val)), [yieldDto]);
