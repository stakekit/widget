import {
  createRoutesFromElements,
  matchRoutes,
  type RouteObject,
} from "react-router";
import { describe, expect, it } from "vitest";
import { createCompactRoutes } from "../../../src/app/layouts/compact/compact-routes";
import { createDashboardRoutes } from "../../../src/app/layouts/dashboard/dashboard-routes";
import type { WidgetLayout } from "../../../src/services/config/widget-config-model";
import {
  widgetBorrowFlowRoutes,
  widgetRoutes,
  widgetYieldFlowRoutes,
} from "../../../src/services/navigation/widget-routes";

type RegistryRoute = Readonly<{
  readonly build: (...args: ReadonlyArray<unknown>) => string;
  readonly descendants: string;
  readonly layouts: ReadonlyArray<WidgetLayout>;
  readonly paramNames: ReadonlyArray<string>;
  readonly pattern: string;
}>;

const registryRoutes: ReadonlyArray<RegistryRoute> = [
  ...Object.values(widgetRoutes),
  ...[
    ...Object.values(widgetYieldFlowRoutes),
    ...Object.values(widgetBorrowFlowRoutes),
  ].flatMap((flow) => [flow.review, flow.steps, flow.complete]),
] as ReadonlyArray<RegistryRoute>;

const layoutRoutes: Readonly<Record<WidgetLayout, ReadonlyArray<RouteObject>>> =
  {
    Compact: createRoutesFromElements(createCompactRoutes()),
    Dashboard: createRoutesFromElements(
      createDashboardRoutes({ registerEarnFooterButton: false })
    ),
  };

const samplePath = (route: RegistryRoute, layout: WidgetLayout) =>
  route.build(
    layout,
    Object.fromEntries(route.paramNames.map((name) => [name, `sample-${name}`]))
  );

/**
 * The registry route a path renders in a Layout's tree: the deepest matched
 * route with a path, or the root for index routes under pathless layouts.
 * Null when only a catch-all matches.
 */
const mountedPattern = (
  routes: ReadonlyArray<RouteObject>,
  path: string
): string | null => {
  const matches = matchRoutes([...routes], path) ?? [];
  if (matches.length === 0) return null;
  const withPath = matches.filter((match) => match.route.path !== undefined);
  const deepest = withPath.at(-1)?.route.path ?? widgetRoutes.earn.pattern;
  return deepest === "*" ? null : deepest;
};

const treePaths = (routes: ReadonlyArray<RouteObject>): ReadonlyArray<string> =>
  routes.flatMap((route) => [
    ...(route.path === undefined ? [] : [route.path]),
    ...treePaths(route.children ?? []),
  ]);

describe.each(["Compact", "Dashboard"] as const)(
  "%s Layout routes",
  (layout) => {
    const routes = layoutRoutes[layout];

    it.each(
      registryRoutes
        .filter((route) => route.layouts.includes(layout))
        .map((route) => [route.pattern, route] as const)
    )("mounts %s", (_pattern, route) => {
      expect([route.pattern, route.descendants]).toContain(
        mountedPattern(routes, samplePath(route, layout))
      );
    });

    it.each(
      registryRoutes
        .filter((route) => !route.layouts.includes(layout))
        .map((route) => [route.pattern, route] as const)
    )("does not mount %s", (_pattern, route) => {
      expect([route.pattern, route.descendants]).not.toContain(
        mountedPattern(routes, samplePath(route, layout))
      );
    });

    it("mounts only registry patterns", () => {
      const known = new Set([
        "*",
        ...registryRoutes.flatMap((route) => [
          route.pattern,
          route.descendants,
        ]),
      ]);
      expect(treePaths(routes).filter((path) => !known.has(path))).toEqual([]);
    });
  }
);
