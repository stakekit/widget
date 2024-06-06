import type { YieldDto } from "@stakekit/api-hooks";
import type { Maybe } from "purify-ts";
import { useMemo } from "react";
import { getGasFeeToken } from "../domain";

export const useGasFeeToken = (yieldDto: Maybe<YieldDto>) =>
  useMemo(() => yieldDto.map((val) => getGasFeeToken(val)), [yieldDto]);
