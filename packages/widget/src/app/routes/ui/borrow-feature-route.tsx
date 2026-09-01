import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";
import { useWidgetConfig } from "../../../features/widget-configuration/index";

export const BorrowFeatureRoute = ({
  fallbackPath,
}: {
  readonly fallbackPath: string;
}): ReactNode =>
  useWidgetConfig("borrowEnabled") ? (
    <Outlet />
  ) : (
    <Navigate to={fallbackPath} replace />
  );
