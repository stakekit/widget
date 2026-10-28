import { Schema } from "effect";
import { YieldCategory } from "../../../domain/earn/contract";
import { widgetRoutes } from "../../../services/navigation/widget-routes";

/** A category press only changes the page after its navigation is accepted. */
export const dashboardEarnRoute = widgetRoutes.earn.withState(
  Schema.Struct({
    yieldCategory: Schema.Literals(Object.values(YieldCategory)),
  })
);
