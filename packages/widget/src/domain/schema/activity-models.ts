import { Schema } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import { YieldAction } from "./action-models";
import { TolerantTopLevelArray } from "./response";

export const ActivityActionsPage = Schema.Struct({
  ...YieldApi.ActionsControllerGetActions200.fields,
  items: Schema.optionalKey(
    TolerantTopLevelArray(YieldAction, {
      operation: "activity-actions",
    })
  ),
});
export type ActivityActionsPage = typeof ActivityActionsPage.Type;
