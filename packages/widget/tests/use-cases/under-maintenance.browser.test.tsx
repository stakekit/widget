import { HttpResponse, http } from "msw";
import { yieldApiRoute } from "../mocks/api-routes";
import { describe, expect, it } from "../utils/test-extend";
import { renderApp } from "../utils/test-utils";

describe("Under maintenance", () => {
  it("Show under maintenance popup", async ({ worker }) => {
    worker.use(
      http.get(yieldApiRoute("/health"), async () => {
        return HttpResponse.json({
          status: "FAIL",
          timestamp: "2026-07-23T00:00:00.000Z",
        });
      })
    );

    const app = await renderApp();

    await expect
      .element(app.getByTestId("under-maintenance"))
      .toBeInTheDocument();

    await app.unmount();
  });

  it("shows maintenance instead of Dashboard routes", async ({ worker }) => {
    worker.use(
      http.get(yieldApiRoute("/health"), async () => {
        return HttpResponse.json({
          status: "FAIL",
          timestamp: "2026-07-23T00:00:00.000Z",
        });
      })
    );

    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        dashboardVariant: true,
      },
    });

    await expect
      .element(app.getByTestId("under-maintenance"))
      .toBeInTheDocument();
    await expect.element(app.getByText("Manage")).not.toBeInTheDocument();

    await app.unmount();
  });
});
