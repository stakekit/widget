import { Schema, Struct } from "effect";

import * as YieldApi from "../../generated/api/yield-schema";
import { TolerantArray, TolerantNullOr } from "../decoding/response-schema";
import { ExactDecimal } from "../finance/scalars";
import { Token } from "../token/token";

/**
 * An optional decimal the widget reads: a malformed value becomes `null` so
 * only that field is lost, never the model holding it.
 */
export const TolerantExactDecimal = (operation: string, field: string) =>
  TolerantNullOr(ExactDecimal, { operation, field });

// `yieldSource` stays open: reward-rate breakdowns already fall back for
// sources they do not group.
const EarnReward = Schema.Struct({
  ...Struct.pick(YieldApi.RewardDto.fields, ["rateType"]),
  rate: ExactDecimal,
  token: Token,
  yieldSource: Schema.String,
});

export const EarnRewardRate = Schema.Struct({
  ...Struct.pick(YieldApi.RewardRateDto.fields, ["rateType"]),
  components: TolerantArray(EarnReward, {
    operation: "reward-rate-components",
  }),
  total: ExactDecimal,
});
