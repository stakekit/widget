import { RegistryProvider } from "@effect/atom-react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../src/app/config/settings";
import { BorrowFeatureRoute } from "../../src/app/routes/borrow-feature-route";
import { render } from "../utils/test-utils.dom";

const LocationProbe = () => {
  const location = useLocation();

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
    <RegistryProvider
      initialValues={[
        [
          widgetConfigAtom,
          normalizeWidgetConfig({
            apiKey: "api-key",
            borrowEnabled,
            dashboardVariant: true,
            variant: "default",
          }),
        ],
      ]}
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
    </RegistryProvider>
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
});
