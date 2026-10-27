import { widgetRoutes } from "../../../services/navigation/widget-routes";
import {
  useWidgetRouteMatch,
  useWidgetRoutePrefixMatch,
} from "../../navigation/index";

export const useUnstakeOrPendingActionParams = () => {
  const positionMatch = useWidgetRoutePrefixMatch(widgetRoutes.positionDetails);
  const pendingActionSelectValidatorMatch = useWidgetRouteMatch(
    widgetRoutes.positionSelectValidator
  );

  const balanceId = positionMatch?.balanceId;
  const integrationId = positionMatch?.integrationId;
  const pendingActionType =
    pendingActionSelectValidatorMatch?.pendingActionType;

  return {
    balanceId: balanceId ?? null,
    integrationId: integrationId ?? null,
    pendingActionType: pendingActionType ?? null,
    plain: {
      balanceId,
      integrationId,
      pendingActionType,
    },
  };
};
