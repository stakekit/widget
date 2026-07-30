import { isValidElement, type ReactElement, type ReactNode } from "react";
import { createRoutesFromElements, type RouteObject } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { createBorrowTransactionFlowRoutes } from "../../src/features/borrow-transaction-flow/ui";

vi.mock(
  "../../src/features/borrow-transaction-flow/react/borrow-flow-route",
  () => ({
    BorrowTransactionFlowCompletionGuard:
      function BorrowTransactionFlowCompletionGuard() {
        return null;
      },
    BorrowTransactionFlowExecutionScope:
      function BorrowTransactionFlowExecutionScope() {
        return null;
      },
    BorrowTransactionFlowReviewRoute:
      function BorrowTransactionFlowReviewRoute() {
        return null;
      },
    BorrowTransactionFlowRoute: function BorrowTransactionFlowRoute() {
      return null;
    },
  })
);
vi.mock("../../src/features/borrow-transaction-flow/ui/complete", () => ({
  BorrowCompletePage: function BorrowCompletePage() {
    return null;
  },
}));
vi.mock("../../src/features/borrow-transaction-flow/ui/review", () => ({
  BorrowReviewPage: function BorrowReviewPage() {
    return null;
  },
}));
vi.mock("../../src/features/borrow-transaction-flow/ui/steps", () => ({
  BorrowStepsPage: function BorrowStepsPage() {
    return null;
  },
}));

type ElementProps = Readonly<{
  children?: ReactNode;
  expected?: string;
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
  return node.props.expected ? `${name}(${node.props.expected})` : name;
};

const describeRoute = (route: RouteObject): RouteContract => ({
  children: (route.children ?? []).map(describeRoute),
  element: describeElement(route.element),
  path: route.path ?? null,
});

describe("Borrow Transaction Flow routes", () => {
  it.each(["BorrowEntry", "MarketPosition"] as const)(
    "publishes the %s journey",
    (entry) => {
      const routes = createRoutesFromElements(
        createBorrowTransactionFlowRoutes({ entry })
      );

      expect(routes.map(describeRoute)).toEqual([
        {
          children: [
            {
              children: [
                {
                  children: [],
                  element: "BorrowReviewPage",
                  path: "review",
                },
              ],
              element: "BorrowTransactionFlowReviewRoute",
              path: null,
            },
            {
              children: [
                {
                  children: [],
                  element: "BorrowStepsPage",
                  path: "steps",
                },
                {
                  children: [
                    {
                      children: [],
                      element: "BorrowCompletePage",
                      path: "complete",
                    },
                  ],
                  element: "BorrowTransactionFlowCompletionGuard",
                  path: null,
                },
              ],
              element: "BorrowTransactionFlowExecutionScope",
              path: null,
            },
          ],
          element: `BorrowTransactionFlowRoute(${entry})`,
          path: null,
        },
      ]);
    }
  );
});
