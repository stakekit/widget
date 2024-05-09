import type { YieldDto } from "@stakekit/api-hooks";
import type { State } from "./types";
import {
  getInitMinStakeAmount,
  getInitSelectedValidators,
} from "../../domain/types/stake";
import { Maybe } from "purify-ts";
import type { QueryParams } from "../../domain/types/query-params";

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
