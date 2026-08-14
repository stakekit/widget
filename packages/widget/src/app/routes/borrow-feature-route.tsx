import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";
import { useWidgetConfig } from "../composition/use-widget-config";

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
