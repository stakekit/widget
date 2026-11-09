import { Schema, Struct } from "effect";

import * as YieldApi from "../../generated/api/yield-schema";
import { TolerantArray } from "../decoding/response-schema";
import { YieldAction } from "../earn/action-models";

export const ActivityActionsPage = Schema.Struct({
  ...Struct.pick(YieldApi.ActionsControllerGetActions200.fields, [
    "total",
    "offset",
    "limit",
  ]),
  items: Schema.optionalKey(
    TolerantArray(YieldAction, {
      operation: "activity-actions",
    })
  ),
});
export type ActivityActionsPage = typeof ActivityActionsPage.Type;
