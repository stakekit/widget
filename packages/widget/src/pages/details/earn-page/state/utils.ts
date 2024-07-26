import type { InitParams } from "@sk-widget/domain/types/init-params";
import {
  getInitMinStakeAmount,
  getInitSelectedValidators,
} from "@sk-widget/domain/types/stake";
import type { State } from "@sk-widget/pages/details/earn-page/state/types";
import type { YieldDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";

export const onYieldSelectState = ({
  yieldDto,
  initParams,
}: {
  yieldDto: YieldDto;
  initParams: Maybe<InitParams>;
}): Pick<
  State,
  "selectedStakeId" | "stakeAmount" | "selectedValidators" | "tronResource"
> => ({
  selectedStakeId: Maybe.of(yieldDto.id),
  stakeAmount: getInitMinStakeAmount(yieldDto),
  selectedValidators: getInitSelectedValidators({
    initQueryParams: initParams,
    yieldDto: yieldDto,
  }),
  tronResource: Maybe.fromFalsy(
    yieldDto.args.enter.args?.tronResource?.required
  ).map(() => "ENERGY"),
});
