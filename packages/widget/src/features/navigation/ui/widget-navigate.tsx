import type { PropsWithChildren } from "react";
import { type LinkProps, Navigate } from "react-router";
import {
  type WidgetNavigationTarget,
  widgetTargetPath,
  widgetTargetState,
} from "../../../services/navigation/widget-routes";
import { SKLink } from "../../../shared/ui/primitives/link";

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

/** A link to a registry path or location. */
export const WidgetLink = ({
  to,
  ...rest
}: PropsWithChildren<
  Omit<LinkProps, "relative" | "state" | "to"> & {
    readonly to: WidgetNavigationTarget;
  }
>) => (
  <SKLink {...rest} state={widgetTargetState(to)} to={widgetTargetPath(to)} />
);
