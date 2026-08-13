import {
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { describe, expect, it } from "vitest";
import { render } from "../utils/test-utils.dom.tsx";

/**
 * Redirect contract for classic position-details mounts.
 * Keep in sync with `src/app/routes/classic-routes.tsx`.
 */
const ClassicPositionDetailsRedirectRoutes = () => (
  <Routes>
    <Route path="positions/:integrationId/:balanceId">
      <Route index element={<div data-testid="hub">hub</div>} />

      <Route path="stake">
        <Route index element={<Navigate replace to=".." />} />
        <Route path="*" element={<Navigate replace to="../.." />} />
      </Route>

      <Route path="unstake">
        <Route index element={<Navigate replace to=".." />} />
        <Route path="review" element={<div data-testid="unstake-review" />} />
        <Route path="*" element={<Navigate replace to="../.." />} />
      </Route>

      <Route path="pending-action">
        <Route index element={<Navigate replace to=".." />} />
        <Route path="review" element={<div data-testid="pending-review" />} />
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
      <ClassicPositionDetailsRedirectRoutes />
    </MemoryRouter>
  );

describe("classic position details redirects", () => {
  it("keeps the bare hub", async () => {
    const app = await renderAt("/positions/yield-1/balance-1");

    expect(textFor(app.container, "hub")).toBe("hub");
    expect(textFor(app.container, "location")).toBe(
      "/positions/yield-1/balance-1"
    );
  });

  it.each(["stake", "unstake", "pending-action"] as const)(
    "redirects bare %s index to the hub",
    async (suffix) => {
      const app = await renderAt(`/positions/yield-1/balance-1/${suffix}`);

      expect(textFor(app.container, "hub")).toBe("hub");
      expect(textFor(app.container, "location")).toBe(
        "/positions/yield-1/balance-1"
      );
    }
  );

  it.each([
    "/positions/yield-1/balance-1/stake/bogus",
    "/positions/yield-1/balance-1/unstake/bogus",
    "/positions/yield-1/balance-1/pending-action/bogus",
  ] as const)("redirects illegal child %s to the hub", async (path) => {
    const app = await renderAt(path);

    expect(textFor(app.container, "hub")).toBe("hub");
    expect(textFor(app.container, "location")).toBe(
      "/positions/yield-1/balance-1"
    );
  });

  it("redirects unknown position segments to the hub, not home", async () => {
    const app = await renderAt("/positions/yield-1/balance-1/bogus");

    expect(textFor(app.container, "hub")).toBe("hub");
    expect(textFor(app.container, "home")).toBeNull();
    expect(textFor(app.container, "location")).toBe(
      "/positions/yield-1/balance-1"
    );
  });

  it("still reaches real flow children", async () => {
    const unstake = await renderAt(
      "/positions/yield-1/balance-1/unstake/review"
    );
    expect(
      unstake.container.querySelector('[data-testid="unstake-review"]')
    ).not.toBeNull();

    const pending = await renderAt(
      "/positions/yield-1/balance-1/pending-action/review"
    );
    expect(
      pending.container.querySelector('[data-testid="pending-review"]')
    ).not.toBeNull();
  });
});
