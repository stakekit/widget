import type { RouteObject } from "react-router";
import { ApplicationRouteRoot } from "../composition/application-route-content";
import { ApplicationRouteError } from "./ui/application-route-error";

export const applicationRoutes = [
  {
    path: "*",
    Component: ApplicationRouteRoot,
    ErrorBoundary: ApplicationRouteError,
  },
] satisfies RouteObject[];
