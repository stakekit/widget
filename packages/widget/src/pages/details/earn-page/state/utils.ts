import type { InitParams } from "@sk-widget/domain/types/init-params";
import type { PositionsData } from "@sk-widget/domain/types/positions";
import {
  getInitSelectedValidators,
  getMinStakeAmount,
} from "@sk-widget/domain/types/stake";
import type { State } from "@sk-widget/pages/details/earn-page/state/types";
import type { YieldDto } from "@stakekit/api-hooks";
import { List, Maybe } from "purify-ts";

export const onYieldSelectState = ({
  yieldDto,
  positionsData,
  initParams,
}: {
  yieldDto: YieldDto;
  positionsData: PositionsData;
  initParams: Maybe<InitParams>;
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
  selectedValidators: getInitSelectedValidators({
    initQueryParams: initParams,
    yieldDto: yieldDto,
  }),
  tronResource: Maybe.fromFalsy(
    yieldDto.args.enter.args?.tronResource?.required
  ).map(() => "ENERGY"),
  selectedProviderYieldId: Maybe.fromNullable(
    yieldDto.args.enter.args?.providerId
  )
    .filter((val) => val.required)
    .chain((val) => List.head(val.options)),
});
