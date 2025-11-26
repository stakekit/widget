import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { worker } from "../mocks/worker";
import { renderApp } from "../utils/test-utils";

describe("Geo block", () => {
  it("Show geo block popup", async () => {
    worker.use(
      http.get("*/v1/yields/enabled/networks", async () => {
        return HttpResponse.json(
          {
            code: 403,
            countryCode: "AT",
            message: "Access denied",
            regionCode: "AT-9",
            type: "GEO_LOCATION",
          },
          { status: 403 }
        );
      })
    );

    const app = await renderApp();

    await expect.element(app.getByText("Geo Block")).toBeInTheDocument();
    await expect
      .element(app.getByText("This feature is not available in Austria."))
      .toBeInTheDocument();

    app.unmount();
  });
});
