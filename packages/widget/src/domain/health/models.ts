import { Schema, Struct } from "effect";

import * as YieldApi from "../../generated/api/yield-schema";
import { UtcDateTimeFromString } from "../finance/scalars";

export const HealthStatus = Schema.Struct({
  ...Struct.pick(YieldApi.HealthStatusDto.fields, ["status"]),
  timestamp: UtcDateTimeFromString,
});
export type HealthStatus = typeof HealthStatus.Type;
