import type { RouteObject } from "react-router";
import { ApplicationRouteRoot } from "../composition/application-route-content";

export const applicationRoutes = [
  { path: "*", Component: ApplicationRouteRoot },
] satisfies RouteObject[];
