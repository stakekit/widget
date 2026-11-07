import { Navigate } from "react-router";

import {
  type WidgetNavigationTarget,
  widgetTargetPath,
  widgetTargetState,
} from "../../../services/navigation/widget-routes";

/** Redirects to a registry path or location while rendered. */
export const WidgetNavigate = ({
  replace,
  to,
}: {
  readonly replace?: boolean;
  readonly to: WidgetNavigationTarget;
}) => (
  <Navigate
    replace={replace ?? false}
    state={widgetTargetState(to)}
    to={widgetTargetPath(to)}
  />
);
