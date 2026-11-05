import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import { useWidgetRouteMatch } from "../../../navigation/index";
import { WidgetNavigate } from "../../../navigation/views";
import { isBorrowCollateralToggleAction } from "../model/details";
import { BorrowPositionActionsPane } from "./components/actions-pane";
import { useBorrowPositionContext } from "./context";

/**
 * A link to one of the position's actions: the position's actions, which
 * the page opens on that one. A collateral switch has no form, so its link
 * lands on the position.
 */
export const BorrowPositionActionPage = () => {
  const match = useWidgetRouteMatch(widgetRoutes.borrowPositionAction);
  const positionPath = match
    ? widgetRoutes.borrowPosition.build("Dashboard", {
        marketId: match.marketId,
      })
    : widgetRoutes.positions.build();
  const { actions } = useBorrowPositionContext();
  const action = actions.find((candidate) => candidate.id === match?.actionId);

  if (action && isBorrowCollateralToggleAction(action)) {
    return <WidgetNavigate replace to={positionPath} />;
  }

  return <BorrowPositionActionsPane />;
};
