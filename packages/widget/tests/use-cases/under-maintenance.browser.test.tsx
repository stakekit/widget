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
          timestamp: new Date().toISOString(),
        });
      })
    );

    const app = await renderApp();

    await expect
      .element(app.getByTestId("under-maintenance"))
      .toBeInTheDocument();

    app.unmount();
  });
});
