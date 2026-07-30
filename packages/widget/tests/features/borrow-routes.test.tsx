import { isValidElement, type ReactElement, type ReactNode } from "react";
import { createRoutesFromElements, type RouteObject } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  createBorrowEntryRoutes,
  createBorrowMarketPositionRoutes,
} from "../../src/features/borrow/ui";

vi.mock("../../src/features/borrow/borrow-entry/ui/layout", () => ({
  BorrowLayout: function BorrowLayout() {
    return null;
  },
}));
vi.mock("../../src/features/borrow/borrow-entry/ui/page", () => ({
  BorrowFormPage: function BorrowFormPage() {
    return null;
  },
}));
vi.mock("../../src/features/borrow/market-position/ui/action.page", () => ({
  BorrowPositionActionPage: function BorrowPositionActionPage() {
    return null;
  },
}));
vi.mock("../../src/features/borrow/market-position/ui/actions.page", () => ({
  BorrowPositionActionsPage: function BorrowPositionActionsPage() {
    return null;
  },
}));
vi.mock("../../src/features/borrow/market-position/ui/details.page", () => ({
  BorrowPositionDetailsPage: function BorrowPositionDetailsPage() {
    return null;
  },
}));
vi.mock("../../src/features/borrow/wallet/ui/connected-wallet-route", () => ({
  BorrowConnectedWalletRoute: function BorrowConnectedWalletRoute() {
    return null;
  },
}));
vi.mock("../../src/features/wallet/ui", () => ({
  WalletScopeRouteGuard: function WalletScopeRouteGuard() {
    return null;
  },
}));
vi.mock("../../src/features/borrow-transaction-flow/ui", async () => {
  const { Route } = await import("react-router");
  return {
    createBorrowTransactionFlowRoutes: ({
      entry,
    }: {
      readonly entry: string;
    }) => <Route path={`${entry}-flow`} />,
  };
});

type ElementProps = Readonly<{ children?: ReactNode }>;

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
  return getElementName(node);
};

const describeRoute = (route: RouteObject): RouteContract => ({
  children: (route.children ?? []).map(describeRoute),
  element: describeElement(route.element),
  index: route.index === true,
  path: route.path ?? null,
});

describe("Borrow routes", () => {
  it("publishes the Borrow Entry topology", () => {
    const routes = createRoutesFromElements(createBorrowEntryRoutes());

    expect(routes.map(describeRoute)).toEqual([
      {
        children: [
          {
            children: [],
            element: "BorrowFormPage",
            index: true,
            path: null,
          },
          {
            children: [
              {
                children: [
                  {
                    children: [],
                    element: null,
                    index: false,
                    path: "BorrowEntry-flow",
                  },
                ],
                element: "BorrowConnectedWalletRoute",
                index: false,
                path: null,
              },
            ],
            element: "WalletScopeRouteGuard",
            index: false,
            path: null,
          },
        ],
        element: "BorrowLayout",
        index: false,
        path: "borrow",
      },
      {
        children: [],
        element: "Navigate",
        index: false,
        path: "borrow/*",
      },
    ]);
  });

  it("publishes the Market Position topology", () => {
    const routes = createRoutesFromElements(createBorrowMarketPositionRoutes());

    expect(routes.map(describeRoute)).toEqual([
      {
        children: [
          {
            children: [
              {
                children: [
                  {
                    children: [],
                    element: "BorrowPositionActionsPage",
                    index: true,
                    path: null,
                  },
                  {
                    children: [],
                    element: "BorrowPositionActionPage",
                    index: false,
                    path: "action/:actionId",
                  },
                  {
                    children: [],
                    element: null,
                    index: false,
                    path: "MarketPosition-flow",
                  },
                ],
                element: "BorrowPositionDetailsPage",
                index: false,
                path: "borrow/:marketId",
              },
            ],
            element: "BorrowConnectedWalletRoute",
            index: false,
            path: null,
          },
        ],
        element: "WalletScopeRouteGuard",
        index: false,
        path: null,
      },
      {
        children: [],
        element: "Navigate",
        index: false,
        path: "borrow/*",
      },
    ]);
  });
});
