import type { Maybe } from "purify-ts";
import { useMemo } from "react";
import { getBaseToken } from "../domain";
import type { Yield } from "../domain/types/yields";

export const useBaseToken = (yieldDto: Maybe<Yield>) =>
  useMemo(() => yieldDto.map((val) => getBaseToken(val)), [yieldDto]);
