import { Option, Schema, SchemaGetter, Struct } from "effect";

import * as YieldApi from "../../generated/api/yield-schema";
import {
  OpenLiterals,
  TolerantArray,
  TolerantNullOr,
} from "../decoding/response-schema";
import { ExactDecimal } from "../finance/scalars";
import { Token } from "../token/token";

/**
 * An optional decimal the widget reads: a malformed value becomes `null` so
 * only that field is lost, never the model holding it.
 */
export const TolerantExactDecimal = (operation: string, field: string) =>
  TolerantNullOr(ExactDecimal, { operation, field });

/**
 * Where a reward-rate part comes from: the API, or the widget adding an
 * earning Campaign's own rate the API's rate doesn't list yet
 * (`withCampaignRate`). Every decoded part is the API's, whatever the
 * response says; only the widget makes a campaign part, and it is never
 * encoded.
 */
const RatePartOrigin = Schema.Literals(["api", "campaign"]).pipe(
  Schema.encodeTo(Schema.optionalKey(Schema.Unknown), {
    decode: SchemaGetter.transformOptional(() => Option.some("api" as const)),
    encode: SchemaGetter.omit(),
  })
);

const EarnReward = Schema.Struct({
  ...Struct.pick(YieldApi.RewardDto.fields, ["rateType"]),
  rate: ExactDecimal,
  token: Token,
  yieldSource: OpenLiterals(YieldApi.RewardDto.fields.yieldSource),
  origin: RatePartOrigin,
});

export const EarnRewardRate = Schema.Struct({
  ...Struct.pick(YieldApi.RewardRateDto.fields, ["rateType"]),
  components: TolerantArray(EarnReward, {
    operation: "reward-rate-components",
  }),
  total: ExactDecimal,
});
