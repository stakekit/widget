import type { Maybe } from "purify-ts";
import { useMemo } from "react";
import { getGasFeeToken } from "../domain";
import type { Yield } from "../domain/types/yields";

export const useGasFeeToken = (yieldDto: Maybe<Yield>) =>
  useMemo(() => yieldDto.map((val) => getGasFeeToken(val)), [yieldDto]);
