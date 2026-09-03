import { isValidElement, type ReactElement, type ReactNode } from "react";
import { createRoutesFromElements, type RouteObject } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { createActivityActionRoutes } from "../../src/features/activity/composition";

vi.mock("../../src/features/activity/react/activity-action-route", () => ({
  ActivityActionRoute: function ActivityActionRoute() {
    return null;
  },
}));
vi.mock(
  "../../src/features/activity/ui/activity-details/activity-details.page",
  () => ({
    ActivityDetailsPage: function ActivityDetailsPage() {
      return null;
    },
  })
);
vi.mock("../../src/features/classic-transaction-flow/views", () => ({
  YieldActionContinuationCompletePage:
    function YieldActionContinuationCompletePage() {
      return null;
    },
  YieldActionContinuationExecutionScope:
    function YieldActionContinuationExecutionScope() {
      return null;
    },
  YieldActionContinuationStepsPage:
    function YieldActionContinuationStepsPage() {
      return null;
    },
}));

type ElementProps = Readonly<{
  children?: ReactNode;
  fallbackPath?: string;
  presentation?: string;
}>;

const nameOf = (element: ReactElement | null): string | null => {
  if (!element) return null;
  const type = element.type;
  const name = typeof type === "function" ? type.name : String(type);
  const props = element.props as ElementProps;
  if (props.presentation) return `${name}(${props.presentation})`;
  if (props.fallbackPath) return `${name}(${props.fallbackPath})`;
  return name;
};

type RouteDescription = Readonly<{
  children: ReadonlyArray<RouteDescription>;
  element: string | null;
  index: boolean;
  path: string | null;
}>;

const describeRoute = (route: RouteObject): RouteDescription => ({
  children: (route.children ?? []).map(describeRoute),
  element: isValidElement(route.element) ? nameOf(route.element) : null,
  index: route.index ?? false,
  path: route.path ?? null,
});

const actionIdRoute = (presentation: string): RouteDescription => ({
  children: [
    {
      children: [],
      element: "ActivityDetailsPage",
      index: true,
      path: null,
    },
    {
      children: [
        {
          children: [],
          element: "YieldActionContinuationStepsPage",
          index: false,
          path: "steps",
        },
        {
          children: [],
          element: "YieldActionContinuationCompletePage",
          index: false,
          path: "complete",
        },
      ],
      element: "YieldActionContinuationExecutionScope",
      index: false,
      path: null,
    },
  ],
  element: `ActivityActionRoute(${presentation})`,
  index: false,
  path: ":actionId",
});

const ActionScopeGuard = function ActionScopeGuard() {
  return null;
};

describe("Activity routes", () => {
  it("uses Classic details only under an action id", () => {
    const routes = createRoutesFromElements(
      createActivityActionRoutes("Classic")
    );

    expect(routes.map(describeRoute)).toEqual([actionIdRoute("Classic")]);
  });

  it("keeps Dashboard default selection outside the action-scope guard", () => {
    const routes = createRoutesFromElements(
      createActivityActionRoutes("Dashboard", { ActionScopeGuard })
    );

    expect(routes.map(describeRoute)).toEqual([
      {
        children: [
          {
            children: [],
            element: "ActivityDetailsPage",
            index: true,
            path: null,
          },
        ],
        element: "ActivityActionRoute(Dashboard)",
        index: false,
        path: null,
      },
      {
        children: [actionIdRoute("Dashboard")],
        element: "ActionScopeGuard(/activity)",
        index: false,
        path: null,
      },
    ]);
  });
});
