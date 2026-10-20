import { isValidElement, type ReactElement, type ReactNode } from "react";
import { createRoutesFromElements, type RouteObject } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { createBorrowTransactionFlowRoutes } from "../../../src/features/borrow-transaction-flow/composition";

vi.mock(
  "../../../src/features/borrow-transaction-flow/react/borrow-flow-route",
  () => ({
    BorrowTransactionFlowExecutionPage:
      function BorrowTransactionFlowExecutionPage() {
        return null;
      },
    BorrowTransactionFlowExecutionRoute:
      function BorrowTransactionFlowExecutionRoute() {
        return null;
      },
    BorrowTransactionFlowRoute: function BorrowTransactionFlowRoute() {
      return null;
    },
  })
);
vi.mock("../../../src/features/borrow-transaction-flow/ui/complete", () => ({
  BorrowCompletePage: function BorrowCompletePage() {
    return null;
  },
}));
vi.mock("../../../src/features/borrow-transaction-flow/ui/review", () => ({
  BorrowReviewPage: function BorrowReviewPage() {
    return null;
  },
}));
vi.mock("../../../src/features/borrow-transaction-flow/ui/steps", () => ({
  BorrowStepsPage: function BorrowStepsPage() {
    return null;
  },
}));

type ElementProps = Readonly<{
  children?: ReactNode;
  expected?: string;
  page?: string;
}>;

type RouteContract = Readonly<{
  children: ReadonlyArray<RouteContract>;
  element: string | null;
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
  const described = node.props.page ? `${name}(${node.props.page})` : name;
  if (!isValidElement(node.props.children)) return described;

  return `${described}>${getElementName(node.props.children)}`;
};

const describeRoute = (route: RouteObject): RouteContract => ({
  children: (route.children ?? []).map(describeRoute),
  element: describeElement(route.element),
  path: route.path ?? null,
});

const flowPagesContract: ReadonlyArray<RouteContract> = [
  {
    children: [],
    element: "BorrowReviewPage",
    path: "review",
  },
  {
    children: [
      {
        children: [],
        element: "BorrowTransactionFlowExecutionPage(Steps)>BorrowStepsPage",
        path: "steps",
      },
      {
        children: [],
        element:
          "BorrowTransactionFlowExecutionPage(Complete)>BorrowCompletePage",
        path: "complete",
      },
    ],
    element: "BorrowTransactionFlowExecutionRoute",
    path: null,
  },
];

const BorrowFlowLayout = () => null;

describe("Borrow Transaction Flow routes", () => {
  it.each(["BorrowEntry", "MarketPosition"] as const)(
    "publishes the %s journey",
    (entry) => {
      const routes = createRoutesFromElements(
        createBorrowTransactionFlowRoutes({ entry })
      );

      expect(routes.map(describeRoute)).toEqual([
        {
          children: flowPagesContract,
          element: `BorrowTransactionFlowRoute(${entry})`,
          path: null,
        },
      ]);
    }
  );

  it("nests the flow pages in a layout inside the Flow Session", () => {
    const routes = createRoutesFromElements(
      createBorrowTransactionFlowRoutes({
        entry: "MarketPosition",
        layout: <BorrowFlowLayout />,
      })
    );

    expect(routes.map(describeRoute)).toEqual([
      {
        children: [
          {
            children: flowPagesContract,
            element: "BorrowFlowLayout",
            path: null,
          },
        ],
        element: "BorrowTransactionFlowRoute(MarketPosition)",
        path: null,
      },
    ]);
  });
});
