import { isValidElement, type ReactElement, type ReactNode } from "react";
import {
  createRoutesFromElements,
  matchRoutes,
  type RouteObject,
} from "react-router";
import { describe, expect, it, vi } from "vitest";
import { createClassicFlowRoutes } from "../../src/features/classic-transaction-flow/ui";

vi.mock(
  "../../src/features/classic-transaction-flow/react/classic-flow-route",
  () => ({
    ClassicFlowExecutionScope: function ClassicFlowExecutionScope() {
      return null;
    },
    ClassicFlowReviewScope: function ClassicFlowReviewScope() {
      return null;
    },
    ClassicFlowRoute: function ClassicFlowRoute() {
      return null;
    },
  })
);
vi.mock(
  "../../src/features/classic-transaction-flow/ui/activity-details.page",
  () => ({
    ActivityDetailsPage: function ActivityDetailsPage() {
      return null;
    },
  })
);
vi.mock(
  "../../src/features/classic-transaction-flow/ui/complete/pages/activity-complete.page",
  () => ({
    ActivityCompletePage: function ActivityCompletePage() {
      return null;
    },
  })
);
vi.mock(
  "../../src/features/classic-transaction-flow/ui/complete/pages/pending-complete.page",
  () => ({
    PendingCompletePage: function PendingCompletePage() {
      return null;
    },
  })
);
vi.mock(
  "../../src/features/classic-transaction-flow/ui/complete/pages/stake-complete.page",
  () => ({
    StakeCompletePage: function StakeCompletePage() {
      return null;
    },
  })
);
vi.mock(
  "../../src/features/classic-transaction-flow/ui/complete/pages/unstake-complete.page",
  () => ({
    UnstakeCompletePage: function UnstakeCompletePage() {
      return null;
    },
  })
);
vi.mock(
  "../../src/features/classic-transaction-flow/ui/review/pages/action-review.page",
  () => ({
    ActionReviewPage: function ActionReviewPage() {
      return null;
    },
  })
);
vi.mock(
  "../../src/features/classic-transaction-flow/ui/review/pages/pending-review.page",
  () => ({
    PendingReviewPage: function PendingReviewPage() {
      return null;
    },
  })
);
vi.mock(
  "../../src/features/classic-transaction-flow/ui/review/pages/stake-review.page",
  () => ({
    StakeReviewPage: function StakeReviewPage() {
      return null;
    },
  })
);
vi.mock(
  "../../src/features/classic-transaction-flow/ui/review/pages/unstake-review.page",
  () => ({
    UnstakeReviewPage: function UnstakeReviewPage() {
      return null;
    },
  })
);
vi.mock(
  "../../src/features/classic-transaction-flow/ui/steps/pages/activity-steps.page",
  () => ({
    ActivityStepsPage: function ActivityStepsPage() {
      return null;
    },
  })
);
vi.mock(
  "../../src/features/classic-transaction-flow/ui/steps/pages/pending-steps.page",
  () => ({
    PendingStepsPage: function PendingStepsPage() {
      return null;
    },
  })
);
vi.mock(
  "../../src/features/classic-transaction-flow/ui/steps/pages/stake-steps.page",
  () => ({
    StakeStepsPage: function StakeStepsPage() {
      return null;
    },
  })
);
vi.mock(
  "../../src/features/classic-transaction-flow/ui/steps/pages/unstake-steps.page",
  () => ({
    UnstakeStepsPage: function UnstakeStepsPage() {
      return null;
    },
  })
);

type ElementProps = Readonly<{
  children?: ReactNode;
  expected?: string;
}>;

type RouteContract = Readonly<{
  children: ReadonlyArray<RouteContract>;
  element: string | null;
  index: boolean;
  path: string | null;
}>;

const getElementName = (element: ReactElement): string => {
  if (typeof element.type === "string") return element.type;
  if (typeof element.type === "function") return element.type.name;
  return "Anonymous";
};

const describeElement = (node: ReactNode): string | null => {
  if (!isValidElement<ElementProps>(node)) return null;

  const name = getElementName(node);
  if (node.props.expected) return `${name}(${node.props.expected})`;
  if (!isValidElement(node.props.children)) return name;

  return `${name}>${getElementName(node.props.children)}`;
};

const describeRoute = (route: RouteObject): RouteContract => ({
  children: (route.children ?? []).map(describeRoute),
  element: describeElement(route.element),
  index: route.index === true,
  path: route.path ?? null,
});

const getRouteContract = (
  routeElement: ReturnType<typeof createClassicFlowRoutes>
): ReadonlyArray<RouteContract> =>
  createRoutesFromElements(routeElement).map(describeRoute);

const standardRouteContract = ({
  completePage,
  journey,
  reviewPage,
  stepsPage,
}: {
  readonly completePage: string;
  readonly journey: "Enter" | "Exit" | "Manage";
  readonly reviewPage: string;
  readonly stepsPage: string;
}): ReadonlyArray<RouteContract> => [
  {
    children: [
      {
        children: [],
        element: `ClassicFlowReviewScope>${reviewPage}`,
        index: false,
        path: "review",
      },
      {
        children: [
          {
            children: [],
            element: stepsPage,
            index: false,
            path: "steps",
          },
          {
            children: [],
            element: completePage,
            index: false,
            path: "complete",
          },
        ],
        element: "ClassicFlowExecutionScope",
        index: false,
        path: null,
      },
    ],
    element: `ClassicFlowRoute(${journey})`,
    index: false,
    path: null,
  },
];

describe("Classic Transaction Flow routes", () => {
  it.each([
    [
      "Enter",
      {
        completePage: "StakeCompletePage",
        reviewPage: "StakeReviewPage",
        stepsPage: "StakeStepsPage",
      },
    ],
    [
      "Exit",
      {
        completePage: "UnstakeCompletePage",
        reviewPage: "UnstakeReviewPage",
        stepsPage: "UnstakeStepsPage",
      },
    ],
    [
      "Manage",
      {
        completePage: "PendingCompletePage",
        reviewPage: "PendingReviewPage",
        stepsPage: "PendingStepsPage",
      },
    ],
  ] as const)("publishes the %s journey", (journey, pages) => {
    expect(getRouteContract(createClassicFlowRoutes({ journey }))).toEqual(
      standardRouteContract({ journey, ...pages })
    );
  });

  it("publishes the Classic Activity Resume presentation", () => {
    expect(
      getRouteContract(
        createClassicFlowRoutes({
          journey: "ActivityResume",
          presentation: "Classic",
        })
      )
    ).toEqual([
      {
        children: [
          {
            children: [],
            element: "ClassicFlowReviewScope>ActionReviewPage",
            index: false,
            path: "review",
          },
          {
            children: [
              {
                children: [],
                element: "ActivityStepsPage",
                index: false,
                path: ":pendingActionType/steps",
              },
              {
                children: [],
                element: "ActivityCompletePage",
                index: false,
                path: ":pendingActionType/complete",
              },
            ],
            element: "ClassicFlowExecutionScope",
            index: false,
            path: null,
          },
        ],
        element: "ClassicFlowRoute(ActivityResume)",
        index: false,
        path: null,
      },
    ]);
  });

  it("publishes the Dashboard Activity Resume presentation without a Complete route", () => {
    const routes = createRoutesFromElements(
      createClassicFlowRoutes({
        journey: "ActivityResume",
        presentation: "Dashboard",
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
          {
            children: [
              {
                children: [],
                element: "ActivityStepsPage",
                index: false,
                path: ":pendingActionType/steps",
              },
            ],
            element: "ClassicFlowExecutionScope",
            index: false,
            path: null,
          },
        ],
        element: "ClassicFlowRoute(ActivityResume)",
        index: false,
        path: null,
      },
    ]);
    expect(matchRoutes(routes, "/stake/complete")).toBeNull();
  });
});
