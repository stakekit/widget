import { useEffect } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { BorrowFeatureRoute } from "../../src/app/routes/ui/borrow-feature-route";
import { render } from "../utils/test-utils.dom.tsx";
import { TestWidgetConfigProvider } from "../utils/widget-config-provider";

const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{location.pathname}</output>;
};

const BorrowScopeProbe = ({
  onUnmount,
}: {
  readonly onUnmount: () => void;
}) => {
  const location = useLocation();
  useEffect(() => onUnmount, [onUnmount]);

  return <output data-testid="location">{location.pathname}</output>;
};

const renderRoute = ({
  borrowEnabled,
  initialPath,
}: {
  readonly borrowEnabled: boolean;
  readonly initialPath: string;
}) =>
  render(
    <TestWidgetConfigProvider
      apiKey="api-key"
      borrowEnabled={borrowEnabled}
      dashboardVariant
      variant="default"
    >
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<BorrowFeatureRoute fallbackPath="/" />}>
            <Route path="/borrow/*" element={<LocationProbe />} />
          </Route>
          <Route element={<BorrowFeatureRoute fallbackPath="/positions" />}>
            <Route path="/positions/borrow/*" element={<LocationProbe />} />
          </Route>
          <Route path="/" element={<LocationProbe />} />
          <Route path="/positions" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </TestWidgetConfigProvider>
  );

describe("BorrowFeatureRoute", () => {
  it.each([
    ["/borrow/unknown", "/"],
    ["/positions/borrow/market-1", "/positions"],
  ])(
    "redirects disabled Borrow navigation from %s to %s",
    async (initialPath, expectedPath) => {
      const app = await renderRoute({ borrowEnabled: false, initialPath });

      expect(
        app.container.querySelector('[data-testid="location"]')?.textContent
      ).toBe(expectedPath);
    }
  );

  it.each(["/borrow/review", "/positions/borrow/market-1"])(
    "allows enabled Borrow navigation to %s",
    async (initialPath) => {
      const app = await renderRoute({ borrowEnabled: true, initialPath });

      expect(
        app.container.querySelector('[data-testid="location"]')?.textContent
      ).toBe(initialPath);
    }
  );

  it("unmounts the Borrow route scope when Borrow is disabled", async () => {
    const finalized = vi.fn();
    const routeTree = (borrowEnabled: boolean) => (
      <TestWidgetConfigProvider
        apiKey="api-key"
        borrowEnabled={borrowEnabled}
        dashboardVariant
        variant="default"
      >
        <MemoryRouter initialEntries={["/borrow/review"]}>
          <Routes>
            <Route element={<BorrowFeatureRoute fallbackPath="/" />}>
              <Route
                path="/borrow/*"
                element={<BorrowScopeProbe onUnmount={finalized} />}
              />
            </Route>
            <Route path="/" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </TestWidgetConfigProvider>
    );
    const app = await render(routeTree(true));

    expect(finalized).not.toHaveBeenCalled();
    await app.rerender(routeTree(false));

    expect(
      app.container.querySelector('[data-testid="location"]')?.textContent
    ).toBe("/");
    expect(finalized).toHaveBeenCalledOnce();
  });
});
