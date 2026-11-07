import { isValidElement, type ReactElement, type ReactNode } from "react";
import { createRoutesFromElements, type RouteObject } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { createYieldFlowRoutes } from "../../../src/features/yield-transaction-flow/composition";
import { widgetYieldFlowRoutes } from "../../../src/services/navigation/widget-routes";

vi.mock(
  "../../../src/features/yield-transaction-flow/react/yield-flow-route",
  () => ({
    YieldFlowExecutionPage: function YieldFlowExecutionPage() {
      return null;
    },
    YieldFlowExecutionRoute: function YieldFlowExecutionRoute() {
      return null;
    },
    YieldFlowRoute: function YieldFlowRoute() {
      return null;
    },
  })
);
vi.mock(
  "../../../src/features/yield-transaction-flow/ui/complete/pages/pending-complete.page",
  () => ({
    PendingCompletePage: function PendingCompletePage() {
      return null;
    },
  })
);
vi.mock(
  "../../../src/features/yield-transaction-flow/ui/complete/pages/enter-complete.page",
  () => ({
    EnterCompletePage: function EnterCompletePage() {
      return null;
    },
  })
);
vi.mock(
  "../../../src/features/yield-transaction-flow/ui/complete/pages/exit-complete.page",
  () => ({
    ExitCompletePage: function ExitCompletePage() {
      return null;
    },
  })
);
vi.mock(
  "../../../src/features/yield-transaction-flow/ui/review/pages/pending-review.page",
  () => ({
    PendingReviewPage: function PendingReviewPage() {
      return null;
    },
  })
);
vi.mock(
  "../../../src/features/yield-transaction-flow/ui/review/pages/enter-review.page",
  () => ({
    EnterReviewPage: function EnterReviewPage() {
      return null;
    },
  })
);
vi.mock(
  "../../../src/features/yield-transaction-flow/ui/review/pages/exit-review.page",
  () => ({
    ExitReviewPage: function ExitReviewPage() {
      return null;
    },
  })
);
vi.mock(
  "../../../src/features/yield-transaction-flow/ui/steps/pages/pending-steps.page",
  () => ({
    PendingStepsPage: function PendingStepsPage() {
      return null;
    },
  })
);
vi.mock(
  "../../../src/features/yield-transaction-flow/ui/steps/pages/enter-steps.page",
  () => ({
    EnterStepsPage: function EnterStepsPage() {
      return null;
    },
  })
);
vi.mock(
  "../../../src/features/yield-transaction-flow/ui/steps/pages/exit-steps.page",
  () => ({
    ExitStepsPage: function ExitStepsPage() {
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
  routeElement: ReturnType<typeof createYieldFlowRoutes>
): ReadonlyArray<RouteContract> =>
  createRoutesFromElements(routeElement).map(describeRoute);

const standardRouteContract = ({
  completePage,
  journey,
  mount,
  reviewPage,
  stepsPage,
}: {
  readonly completePage: string;
  readonly journey: "Enter" | "Exit" | "Manage";
  readonly mount: "Earn" | "PositionExit" | "PositionManage" | "PositionStake";
  readonly reviewPage: string;
  readonly stepsPage: string;
}): ReadonlyArray<RouteContract> => [
  {
    children: [
      {
        children: [],
        element: reviewPage,
        index: false,
        path: widgetYieldFlowRoutes[mount].review.pattern,
      },
      {
        children: [
          {
            children: [],
            element: `YieldFlowExecutionPage>${stepsPage}`,
            index: false,
            path: widgetYieldFlowRoutes[mount].steps.pattern,
          },
          {
            children: [],
            element: `YieldFlowExecutionPage>${completePage}`,
            index: false,
            path: widgetYieldFlowRoutes[mount].complete.pattern,
          },
        ],
        element: "YieldFlowExecutionRoute",
        index: false,
        path: null,
      },
    ],
    element: `YieldFlowRoute(${journey})`,
    index: false,
    path: null,
  },
];

describe("Yield Transaction Flow routes", () => {
  it.each([
    [
      "Earn",
      "Enter",
      {
        completePage: "EnterCompletePage",
        reviewPage: "EnterReviewPage",
        stepsPage: "EnterStepsPage",
      },
    ],
    [
      "PositionStake",
      "Enter",
      {
        completePage: "EnterCompletePage",
        reviewPage: "EnterReviewPage",
        stepsPage: "EnterStepsPage",
      },
    ],
    [
      "PositionExit",
      "Exit",
      {
        completePage: "ExitCompletePage",
        reviewPage: "ExitReviewPage",
        stepsPage: "ExitStepsPage",
      },
    ],
    [
      "PositionManage",
      "Manage",
      {
        completePage: "PendingCompletePage",
        reviewPage: "PendingReviewPage",
        stepsPage: "PendingStepsPage",
      },
    ],
  ] as const)(
    "publishes the %s mount's %s journey",
    (mount, journey, pages) => {
      expect(getRouteContract(createYieldFlowRoutes({ mount }))).toEqual(
        standardRouteContract({ journey, mount, ...pages })
      );
    }
  );
});
