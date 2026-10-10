import { Schema } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import { YieldAction } from "../action/models";
import { TolerantArray } from "../decoding/response-schema";

export const ActivityActionsPage = Schema.Struct({
  ...YieldApi.ActionsControllerGetActions200.fields,
  items: Schema.optionalKey(
    TolerantArray(YieldAction, {
      operation: "activity-actions",
    })
  ),
});
export type ActivityActionsPage = typeof ActivityActionsPage.Type;
