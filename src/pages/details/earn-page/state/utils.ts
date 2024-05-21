import type { QueryParams } from "@sk-widget/domain/types/query-params";
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
  initParams: Maybe<QueryParams>;
}): Pick<State, "selectedStakeId" | "stakeAmount" | "selectedValidators"> => ({
  selectedStakeId: Maybe.of(yieldDto.id),
  stakeAmount: getInitMinStakeAmount(yieldDto),
  selectedValidators: getInitSelectedValidators({
    initQueryParams: initParams,
    yieldDto: yieldDto,
  }),
});
