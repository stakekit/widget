import type { WidgetLayout } from "../config/widget-config-model";
import type { InitTab } from "../wallet/init-params";
import { type WidgetPath, widgetRoutes } from "./widget-routes";

/**
 * Resolves a decoded route-level tab into the first memory-router entry. Both
 * Layouts accept cross-Layout aliases; Borrow opens only where it is mounted.
 */
export const resolveInitialRoutePath = ({
  borrowAvailable,
  layout,
  tab,
}: {
  readonly borrowAvailable: boolean;
  readonly layout: WidgetLayout;
  readonly tab: InitTab;
}): WidgetPath => {
  if (tab === "activity") return widgetRoutes.activity.build();
  if (tab === "positions" || tab === "manage") {
    return widgetRoutes.positions.build();
  }
  if (tab === "borrow" && borrowAvailable && layout === "Dashboard") {
    return widgetRoutes.borrow.build(layout);
  }
  return widgetRoutes.earn.build();
};
