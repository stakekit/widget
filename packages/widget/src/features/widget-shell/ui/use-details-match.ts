import { widgetRoutes } from "../../../services/navigation/widget-routes";
import { useWidgetRouteMatch } from "../../navigation/index";

/** True on the Compact tab pages: Earn, Positions, and Activity. */
export const useDetailsMatch = () => {
  const earnMatch = useWidgetRouteMatch(widgetRoutes.earn);
  const positionsMatch = useWidgetRouteMatch(widgetRoutes.positions);
  const activityMatch = useWidgetRouteMatch(widgetRoutes.activity);

  return (
    earnMatch !== null || positionsMatch !== null || activityMatch !== null
  );
};
