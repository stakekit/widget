import type { YieldDto } from "@stakekit/api-hooks";
import { List, Maybe } from "purify-ts";
import type { PositionsData } from "../../../../domain/types/positions";
import { getMinStakeAmount } from "../../../../domain/types/stake";
import type { State } from "./types";

export const onYieldSelectState = ({
  yieldDto,
  positionsData,
}: {
  yieldDto: YieldDto;
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
    yieldDto.args.enter.args?.tronResource?.required
  ).map(() => "ENERGY"),
  selectedProviderYieldId: Maybe.fromNullable(
    yieldDto.args.enter.args?.providerId
  )
    .filter((val) => val.required)
    .chain((val) => List.head(val.options)),
});
