import type { ReactNode } from "react";
import { Outlet } from "react-router";
import { WidgetNavigate } from "../../../features/navigation/views";
import { useWidgetConfig } from "../../../features/widget-configuration/index";
import type { WidgetPath } from "../../../services/navigation/widget-routes";

export const BorrowFeatureRoute = ({
  fallbackPath,
}: {
  readonly fallbackPath: WidgetPath;
}): ReactNode =>
  useWidgetConfig("borrowEnabled") ? (
    <Outlet />
  ) : (
    <WidgetNavigate replace to={fallbackPath} />
  );
