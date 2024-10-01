import type { ExtendedYieldType } from "@sk-widget/domain/types";
import type { YieldDto } from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";
import type { Maybe } from "purify-ts";

export type YieldTypesData = {
  name: string;
  symbol: YieldDto["token"]["symbol"];
  type: ExtendedYieldType;
  yields: YieldDto[];
  apy: BigNumber;
  min: Maybe<BigNumber>;
  max: Maybe<BigNumber>;
}[];
