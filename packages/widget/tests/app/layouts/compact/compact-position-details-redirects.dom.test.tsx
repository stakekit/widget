import {
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { describe, expect, it } from "vitest";
import {
  widgetRoutes,
  widgetYieldFlowRoutes,
} from "../../../../src/services/navigation/widget-routes";
import { render } from "../../../utils/test-utils.dom.tsx";

/**
 * Redirect contract for Compact position-details mounts: relative redirects
 * under the registry's absolute route patterns.
 * Keep in sync with `src/app/layouts/compact/compact-routes.tsx`.
 */
const CompactPositionDetailsRedirectRoutes = () => (
  <Routes>
    <Route path={widgetRoutes.positionDetails.pattern}>
      <Route index element={<div data-testid="hub">hub</div>} />

      <Route path={widgetRoutes.positionStake.pattern}>
        <Route index element={<Navigate replace to=".." />} />
        <Route path="*" element={<Navigate replace to="../.." />} />
      </Route>

      <Route path={widgetRoutes.positionUnstake.pattern}>
        <Route index element={<Navigate replace to=".." />} />
        <Route
          path={widgetYieldFlowRoutes.PositionExit.review.pattern}
          element={<div data-testid="unstake-review" />}
        />
        <Route path="*" element={<Navigate replace to="../.." />} />
      </Route>

      <Route path={widgetRoutes.positionPendingAction.pattern}>
        <Route index element={<Navigate replace to=".." />} />
        <Route
          path={widgetYieldFlowRoutes.PositionManage.review.pattern}
          element={<div data-testid="pending-review" />}
        />
        <Route path="*" element={<Navigate replace to="../.." />} />
      </Route>

      <Route path="*" element={<Navigate replace relative="path" to=".." />} />
    </Route>

    <Route path="*" element={<div data-testid="home">home</div>} />
  </Routes>
);

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const textFor = (container: HTMLElement, testId: string) =>
  container.querySelector(`[data-testid="${testId}"]`)?.textContent ?? null;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <CompactPositionDetailsRedirectRoutes />
    </MemoryRouter>
  );

describe("compact position details redirects", () => {
  it("keeps the bare hub", async () => {
    const app = await renderAt("/positions/yield-1/default");

    expect(textFor(app.container, "hub")).toBe("hub");
    expect(textFor(app.container, "location")).toBe(
      "/positions/yield-1/default"
    );
  });

  it.each(["stake", "unstake", "pending-action"] as const)(
    "redirects bare %s index to the hub",
    async (suffix) => {
      const app = await renderAt(`/positions/yield-1/default/${suffix}`);

      expect(textFor(app.container, "hub")).toBe("hub");
      expect(textFor(app.container, "location")).toBe(
        "/positions/yield-1/default"
      );
    }
  );

  it.each([
    "/positions/yield-1/default/stake/bogus",
    "/positions/yield-1/default/unstake/bogus",
    "/positions/yield-1/default/pending-action/bogus",
  ] as const)("redirects illegal child %s to the hub", async (path) => {
    const app = await renderAt(path);

    expect(textFor(app.container, "hub")).toBe("hub");
    expect(textFor(app.container, "location")).toBe(
      "/positions/yield-1/default"
    );
  });

  it("redirects unknown position segments to the hub, not home", async () => {
    const app = await renderAt("/positions/yield-1/default/bogus");

    expect(textFor(app.container, "hub")).toBe("hub");
    expect(textFor(app.container, "home")).toBeNull();
    expect(textFor(app.container, "location")).toBe(
      "/positions/yield-1/default"
    );
  });

  it("still reaches real flow children", async () => {
    const unstake = await renderAt("/positions/yield-1/default/unstake/review");
    expect(
      unstake.container.querySelector('[data-testid="unstake-review"]')
    ).not.toBeNull();

    const pending = await renderAt(
      "/positions/yield-1/default/pending-action/review"
    );
    expect(
      pending.container.querySelector('[data-testid="pending-review"]')
    ).not.toBeNull();
  });
});
