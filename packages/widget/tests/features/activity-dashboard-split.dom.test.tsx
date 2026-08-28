import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityPageView } from "../../src/features/activity/state/page";
import { ActivityTabPage } from "../../src/features/activity/ui/dashboard/activity";
import { render } from "../utils/test-utils.dom";

const wallet = vi.hoisted(() => ({
  current: null as { readonly status: string } | null,
}));
const pageView = vi.hoisted(() => ({
  current: { status: "empty" } as ActivityPageView,
}));

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  Outlet: () => <div data-rk="activity-details-outlet" />,
}));
vi.mock(
  "../../src/features/activity/ui/activity-page/activity-page-content",
  () => ({
    ActivityPageContent: () => <div data-rk="activity-feed" />,
  })
);
vi.mock("../../src/features/wallet/index", () => ({
  useSKWallet: () => wallet.current,
}));
vi.mock("@effect/atom-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@effect/atom-react")>()),
  useAtomValue: () => pageView.current,
}));
vi.mock("../../src/features/widget-shell/views", () => ({
  AnimationPage: ({ children }: { readonly children: ReactNode }) => children,
  BackButtonProvider: ({ children }: { readonly children: ReactNode }) =>
    children,
}));

const renderTab = (initialPath = "/activity") =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ActivityTabPage />
    </MemoryRouter>
  );

describe("Dashboard Activity split view", () => {
  beforeEach(() => {
    wallet.current = { status: "connected" };
    pageView.current = {
      actions: [{ actionData: { id: "a1" } } as never],
      filterOptions: [{ count: 1, filter: "all" }],
      pagination: { status: "complete" },
      refreshStatus: "fresh",
      selectedFilter: "all",
      showingCount: 1,
      status: "ready",
      total: 1,
    };
  });

  it("keeps the feed mounted and renders the details outlet when there is activity", async () => {
    const app = await renderTab();

    expect(app.container.querySelector('[data-rk="activity-feed"]')).not.toBe(
      null
    );
    expect(
      app.container.querySelector('[data-rk="activity-details-outlet"]')
    ).not.toBe(null);
    expect(
      app.container.querySelector('[data-rk="activity-details-panel"]')
    ).not.toBe(null);
  });

  it("renders execution without the details inset chrome", async () => {
    const app = await renderTab("/activity/a1/steps");

    expect(
      app.container.querySelector('[data-rk="activity-details-panel"]')
    ).toBe(null);
    expect(
      app.container.querySelector('[data-rk="activity-execution-panel"]')
    ).not.toBe(null);
  });

  it("shows the feed only when the wallet is not connected", async () => {
    wallet.current = { status: "disconnected" };
    const app = await renderTab();

    expect(app.container.querySelector('[data-rk="activity-feed"]')).not.toBe(
      null
    );
    expect(
      app.container.querySelector('[data-rk="activity-details-outlet"]')
    ).toBe(null);
  });

  it("shows the feed only when there is no previous activity", async () => {
    pageView.current = { status: "empty" };
    const app = await renderTab();

    expect(app.container.querySelector('[data-rk="activity-feed"]')).not.toBe(
      null
    );
    expect(
      app.container.querySelector('[data-rk="activity-details-outlet"]')
    ).toBe(null);
  });
});
