import { List, Maybe } from "purify-ts";
import type { PositionsData } from "../../../../domain/types/positions";
import { getMinStakeAmount } from "../../../../domain/types/stake";
import { getYieldActionArg, type Yield } from "../../../../domain/types/yields";
import type { State } from "./types";

export const onYieldSelectState = ({
  yieldDto,
  positionsData,
}: {
  yieldDto: Yield;
  positionsData: PositionsData;
}): Pick<
  State,
  | "selectedStakeId"
  | "stakeAmount"
  | "selectedValidators"
  | "tronResource"
  | "selectedProviderYieldId"
> => ({
  selectedStakeId: Maybe.of(yieldDto.id),
  stakeAmount: getMinStakeAmount(yieldDto, positionsData),
  selectedValidators: new Map(),
  tronResource: Maybe.fromFalsy(
    getYieldActionArg(yieldDto, "enter", "tronResource")?.required,
  ).map(() => "ENERGY"),
  selectedProviderYieldId: Maybe.fromNullable(
    getYieldActionArg(yieldDto, "enter", "providerId"),
  )
    .filter((val) => !!val.required && !!val.options?.length)
    .chain((val) => List.head(val.options ?? [])),
});
