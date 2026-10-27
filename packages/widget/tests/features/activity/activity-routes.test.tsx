import { isValidElement, type ReactElement, type ReactNode } from "react";
import { createRoutesFromElements, type RouteObject } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { createActivityActionRoutes } from "../../../src/features/activity/composition";
import {
  widgetRoutes,
  widgetYieldFlowRoutes,
} from "../../../src/services/navigation/widget-routes";

vi.mock("../../../src/features/activity/react/activity-action-route", () => ({
  ActivityActionRoute: function ActivityActionRoute() {
    return null;
  },
}));
vi.mock(
  "../../../src/features/activity/ui/activity-details/activity-details.page",
  () => ({
    ActivityDetailsPage: function ActivityDetailsPage() {
      return null;
    },
  })
);
vi.mock("../../../src/features/yield-transaction-flow/views", () => ({
  YieldActionContinuationCompletePage:
    function YieldActionContinuationCompletePage() {
      return null;
    },
  YieldActionContinuationExecution:
    function YieldActionContinuationExecution() {
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
  selectsDefaultAction?: boolean;
  showsBackButton?: boolean;
}>;

const nameOf = (element: ReactElement | null): string | null => {
  if (!element) return null;
  const type = element.type;
  const name = typeof type === "function" ? type.name : String(type);
  const props = element.props as ElementProps;
  if (props.selectsDefaultAction !== undefined) {
    return `${name}(selectsDefaultAction=${props.selectsDefaultAction}, showsBackButton=${props.showsBackButton})`;
  }
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

const borrowActionIdRoute = (actionRoute: string): RouteDescription => ({
  children: [
    {
      children: [],
      element: "ActivityDetailsPage",
      index: true,
      path: null,
    },
  ],
  element: actionRoute,
  index: false,
  path: widgetRoutes.activityBorrowAction.pattern,
});

const actionIdRoute = (actionRoute: string): RouteDescription => ({
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
          path: widgetYieldFlowRoutes.YieldActionContinuation.steps.pattern,
        },
        {
          children: [],
          element: "YieldActionContinuationCompletePage",
          index: false,
          path: widgetYieldFlowRoutes.YieldActionContinuation.complete.pattern,
        },
      ],
      element: "YieldActionContinuationExecution",
      index: false,
      path: null,
    },
  ],
  element: actionRoute,
  index: false,
  path: widgetRoutes.activityAction.pattern,
});

const ActionScopeGuard = function ActionScopeGuard() {
  return null;
};

const compactActionRoute =
  "ActivityActionRoute(selectsDefaultAction=false, showsBackButton=true)";
const dashboardActionRoute =
  "ActivityActionRoute(selectsDefaultAction=true, showsBackButton=false)";

describe("Activity routes", () => {
  it("mounts details only under an action id without default selection", () => {
    const routes = createRoutesFromElements(
      createActivityActionRoutes({
        selectsDefaultAction: false,
        showsBackButton: true,
      })
    );

    expect(routes.map(describeRoute)).toEqual([
      borrowActionIdRoute(compactActionRoute),
      actionIdRoute(compactActionRoute),
    ]);
  });

  it("keeps default selection outside the action-scope guard", () => {
    const routes = createRoutesFromElements(
      createActivityActionRoutes({
        ActionScopeGuard,
        selectsDefaultAction: true,
        showsBackButton: false,
      })
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
        element: dashboardActionRoute,
        index: false,
        path: null,
      },
      {
        children: [
          borrowActionIdRoute(dashboardActionRoute),
          actionIdRoute(dashboardActionRoute),
        ],
        element: "ActionScopeGuard(/activity)",
        index: false,
        path: null,
      },
    ]);
  });
});
