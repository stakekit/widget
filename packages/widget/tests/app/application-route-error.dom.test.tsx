import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import { render } from "../utils/test-utils.dom";
import { TestWidgetConfigProvider } from "../utils/widget-config-provider";

const ThrowingRoute = () => {
  throw new Error("WalletBootstrapError");
};

describe("application route error boundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the widget-unavailable view instead of a stack trace", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const router = createMemoryRouter(
      applicationRoutes.map((route) => ({
        ...route,
        Component: ThrowingRoute,
      }))
    );

    const app = await render(
      <TestWidgetConfigProvider apiKey="test-api-key" variant="default">
        <RouterProvider router={router} />
      </TestWidgetConfigProvider>
    );

    await expect
      .poll(
        () =>
          app.container.querySelector('[data-testid="widget-unavailable"]')
            ?.textContent
      )
      .toContain("Something went wrong");
    expect(app.container.textContent).not.toContain("WalletBootstrapError");

    app.unmount();
  });
});
